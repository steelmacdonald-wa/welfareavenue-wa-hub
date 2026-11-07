// wave289, 07/11/26: tests for the shared mail rules. Run: node --test fn/_shared/mail_rules.test.ts (Node 22.6 or later strips the types).
// Every address, name and subject here is invented (example.invalid, example.org, Test ...). No real mail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addressedToMailbox, addrList, cleanSubject, cutAtContact, freshPart, isBulk, isCalendar, isDeliveryReport, isFreemail, isGoogleNotice,
  isNoiseSubject, isPrivateIp, isSecurity, neverRead, normKey, parseAddr, parseBounceText, parseDeliveryStatus, probablyPersonal,
  registeredDomain, robotsRefuses, safeHost, toInfo, validateOrg, validateRead, websiteOk, type Hdr,
} from './mail_rules.ts';

const H = (o: Record<string, string>): Hdr => (n: string) => { const k = Object.keys(o).find(x => x.toLowerCase() === n.toLowerCase()); return k ? o[k] : ''; };

test('mybox bulk combination: List-Unsubscribe with a bulk sign skips; Precedence or Auto-Submitted alone never does', () => {
  assert.equal(isBulk(H({ 'List-Unsubscribe': '<mailto:u@example.invalid>' }), 'news@shop.example.invalid'), true);
  assert.equal(isBulk(H({ 'List-Unsubscribe': '<https://x.list-manage.com/u>' }), 'test.person@example.invalid'), true);
  assert.equal(isBulk(H({ 'List-Unsubscribe': '<mailto:u@example.invalid>', Precedence: 'bulk' }), 'test.person@example.invalid'), true);
  assert.equal(isBulk(H({ Precedence: 'bulk' }), 'news@shop.example.invalid'), false, 'Precedence alone');
  assert.equal(isBulk(H({ 'Auto-Submitted': 'auto-generated' }), 'test.person@example.invalid'), false, 'Auto-Submitted alone');
  assert.equal(isBulk(H({ 'List-Unsubscribe': '<mailto:u@example.invalid>' }), 'test.person@example.invalid'), false, 'a person through a list');
  assert.equal(isBulk(H({ 'List-Unsubscribe': '<mailto:u@example.invalid>' }), 'news@welfareavenue.com'), false, 'never our own domain');
});

test('a Google Group fixture (List-Id, List-Unsubscribe, Delivered-To info@) is addressed to the mailbox and not bulk', () => {
  const h = H({ From: 'Test Writer <test.writer@example.org>', To: 'friends-group@googlegroups.example.invalid', 'List-Id': '<friends-group.googlegroups.example.invalid>',
    'List-Unsubscribe': '<mailto:googlegroups-manage+1+unsubscribe@googlegroups.example.invalid>', 'Delivered-To': 'info@welfareavenue.com' });
  assert.equal(isBulk(h, 'test.writer@example.org'), false);
  assert.equal(addressedToMailbox(h, 'hub@welfareavenue.com', []), true);
});

test('Delivered-To, X-Original-To, info@ and an alias count as addressed to the mailbox; a list copy to others does not', () => {
  assert.equal(addressedToMailbox(H({ 'X-Original-To': 'hub@welfareavenue.com' }), 'hub@welfareavenue.com'), true);
  assert.equal(addressedToMailbox(H({ 'Delivered-To': 'HUB@welfareavenue.com' }), 'hub@welfareavenue.com'), true);
  assert.equal(addressedToMailbox(H({ Cc: 'Info <info@welfareavenue.com>' }), 'steel.macdonald@welfareavenue.com'), true);
  assert.equal(addressedToMailbox(H({ To: 'test.alias@example.invalid' }), 'steel.macdonald@welfareavenue.com', ['Test.Alias@example.invalid']), true);
  assert.equal(addressedToMailbox(H({ To: 'list@lists.example.invalid', 'Delivered-To': 'someone@example.invalid' }), 'hub@welfareavenue.com'), false);
  assert.equal(toInfo(H({ To: 'Info <info@welfareavenue.com>' })), true);
  assert.equal(toInfo(H({ To: 'hub@welfareavenue.com' })), false);
});

test('security, calendar, Google notices and noise', () => {
  assert.equal(isSecurity('Your verification code'), true);
  assert.equal(isSecurity('Hello', 'Your sign-in code is 123456'), true);
  assert.equal(isSecurity('Volunteer question'), false);
  assert.equal(isCalendar('Invitation: Test meeting @ Mon'), true);
  assert.equal(isCalendar('Updated invitation with note: Test'), true);
  assert.equal(isCalendar('Plain subject', 'text/calendar; method=REQUEST'), true);
  assert.equal(isCalendar('Invitation to our gala'), false, 'no colon after the word');
  assert.equal(isGoogleNotice('calendar-notification@google.com'), true);
  assert.equal(isGoogleNotice('test.person@example.invalid'), false);
  assert.equal(isNoiseSubject('Tips for using your new inbox'), true);
});

test('neverRead: the owner\'s senders and words, then the shared list', () => {
  const owner = { skip_senders: ['@family.example.invalid', 'friend@example.invalid', 'club.example.invalid'], skip_words: ['test private'] };
  assert.equal(neverRead(owner, 'cousin@family.example.invalid', 'Hi'), true);
  assert.equal(neverRead(owner, 'friend@example.invalid', 'Hi'), true);
  assert.equal(neverRead(owner, 'a@mail.club.example.invalid', 'Hi'), true);
  assert.equal(neverRead(owner, 'x@example.org', 'A test private matter'), true);
  assert.equal(neverRead(owner, 'x@example.org', 'Medical appointment Tuesday'), true);
  assert.equal(neverRead(null, 'x@example.org', 'Donation question'), false);
});

test('addresses: parsing, lists, keys', () => {
  assert.deepEqual(parseAddr('"Test, Person" <Test.Person@Example.org>'), { name: 'Test, Person', email: 'test.person@example.org' });
  assert.deepEqual(addrList('"Test, A" <a@example.org>, b@example.org, not-an-address'), ['a@example.org', 'b@example.org']);
  assert.equal(normKey('  First.Last@Example.ORG '), 'first.last@example.org');
});

test('freshPart cuts quoted history in English and French', () => {
  assert.equal(freshPart('Thanks!\n\nOn Mon, 1 Jan 2024 at 10:00 Test <t@example.org> wrote:\n> old'), 'Thanks!');
  assert.equal(freshPart('Merci\nLe lun. 1 janv. 2024, Test <t@example.org> a écrit :\n> vieux'), 'Merci');
  assert.equal(freshPart('New\n> quoted\nmore'), 'New\nmore');
});

test('cleanSubject strips prefixes and tags and masks addresses, phones and long numbers', () => {
  assert.equal(cleanSubject('Re: Fwd: [External] Volunteering in May'), 'Volunteering in May');
  assert.equal(cleanSubject('RE: TR: Question from test.person@example.org'), 'Question from [email]');
  assert.equal(cleanSubject('Call me at 514 555 0199 please'), 'Call me at [phone] please');
  assert.equal(cleanSubject('Invoice 12345678 [#TICKET-9]'), 'Invoice [number]');
  assert.equal(cleanSubject('x'.repeat(400)).length, 300);
});

test('probablyPersonal (rule b): free mail only, and a shared family name or a personal word', () => {
  const base = { ownerFamily: 'Testerson', words: ['birthday', 'family dinner'] };
  assert.equal(probablyPersonal({ ...base, outside: ['aunt@gmail.com'], fromName: 'Test Testerson', subject: 'Hello' }), true);
  assert.equal(probablyPersonal({ ...base, outside: ['pal@hotmail.ca'], fromName: 'Test Pal', subject: 'Happy birthday!' }), true);
  assert.equal(probablyPersonal({ ...base, outside: ['pal@hotmail.ca'], fromName: 'Test Pal', subject: 'Family dinner Sunday' }), true);
  assert.equal(probablyPersonal({ ...base, outside: ['pal@hotmail.ca'], fromName: 'Test Pal', subject: 'Volunteering' }), false);
  assert.equal(probablyPersonal({ ...base, outside: ['pal@example.org'], fromName: 'Test Testerson', subject: 'Birthday' }), false, 'not free mail');
  assert.equal(probablyPersonal({ ...base, outside: ['pal@gmail.com', 'org@example.org'], fromName: 'Test Testerson', subject: 'x' }), false, 'one outside address is not free mail');
  assert.equal(isFreemail('videotron.ca', ['videotron']), true);
  assert.equal(isFreemail('mail.example.org'), false);
});

test('delivery reports: the standard part yields its address and 5.x.x; non-standard ones yield one address and 550 or nothing', () => {
  assert.equal(isDeliveryReport('MAILER-DAEMON@example.invalid', 'text/plain'), true);
  assert.equal(isDeliveryReport('x@example.invalid', 'multipart/report; report-type=delivery-status; boundary=b'), true);
  assert.equal(isDeliveryReport('x@example.invalid', 'multipart/mixed'), false);
  const ds = 'Reporting-MTA: dns; mx.example.invalid\n\nFinal-Recipient: rfc822; Gone.Person@example.org\nAction: failed\nStatus: 5.1.1\n';
  assert.deepEqual(parseDeliveryStatus(ds), { addr: 'gone.person@example.org', code: '5.1.1' });
  assert.equal(parseDeliveryStatus('Final-Recipient: rfc822; slow@example.org\nAction: delayed\nStatus: 4.4.1\n'), null, 'a soft bounce');
  assert.equal(parseDeliveryStatus('Final-Recipient: rfc822; x@example.org\nAction: failed\nStatus: 4.2.2\n'), null, 'failed but 4.x.x');
  assert.deepEqual(parseBounceText('Delivery to gone@example.org failed: 550 5.1.1 user unknown', ['hub@welfareavenue.com']), { addr: 'gone@example.org', code: '550' });
  assert.equal(parseBounceText('Mailbox full for full@example.org: 452 4.2.2'), null);
  assert.equal(parseBounceText('550 for a@example.org and b@example.org'), null, 'two addresses');
});

test('validateRead: enums, lines cut before URLs, emails and phones; a website only on the writer\'s domain or linkedin.com', () => {
  const emails = [{ n: 1, writerDomain: 'org.example.org', inbound: true }, { n: 2, writerDomain: 'welfareavenue.com', inbound: false }];
  const raw = { leave_out: 'none', topic: 'partnership', lang: 'en', emails: [
    { n: 1, line: 'Asks to partner on a food drive, see https://org.example.org/form', asks_to_stop: false,
      sig: { name: 'Test Writer', title: 'Director', organization: 'Test Org', phone: '+1 (514) 555-0101', website: 'https://www.org.example.org/' } },
    { n: 2, line: 'WA replies with dates; write to test.writer@org.example.org', asks_to_stop: true, sig: { name: 'Staff' } },
    { n: 9, line: 'not sent', asks_to_stop: false } ] };
  const v = validateRead(raw, emails);
  assert.ok(v.value);
  assert.equal(v.value!.emails.length, 2);
  assert.equal(v.value!.emails[0].line, 'Asks to partner on a food drive, see');
  assert.equal(v.value!.emails[0].sig!.website, 'https://www.org.example.org');
  assert.equal(v.value!.emails[0].sig!.phone, '15145550101');
  assert.equal(v.value!.emails[1].line, 'WA replies with dates; write to');
  assert.equal(v.value!.emails[1].asks_to_stop, false, 'asks-to-stop only from outside');
  assert.equal(v.value!.emails[1].sig, null, 'no signature for WA\'s own email');
  assert.ok(v.cuts >= 2);
  assert.equal(validateRead({ ...raw, topic: 'gossip' }, emails).value, null);
  assert.equal(validateRead({ ...raw, leave_out: 'maybe' }, emails).value, null);
  const other = validateRead({ leave_out: 'none', topic: 'other', lang: 'en', emails: [{ n: 1, line: 'x', sig: { website: 'https://elsewhere.example.invalid' } }] }, emails);
  assert.equal(other.value!.emails[0].sig, null, 'a website on another domain is dropped');
  assert.equal(websiteOk('linkedin.com/in/test-writer', 'org.example.org'), 'https://linkedin.com/in/test-writer');
  assert.equal(websiteOk('https://sub.org.example.org/about', 'org.example.org'), 'https://sub.org.example.org/about');
  const out = validateRead({ leave_out: 'personal', topic: 'other', lang: 'fr', emails: [{ n: 1, line: 'private', asks_to_stop: true, sig: { name: 'X' } }] }, emails);
  assert.deepEqual(out.value!.emails[0], { n: 1, line: '', asks_to_stop: true, sig: null }, 'a left-out thread keeps only asks-to-stop');
});

test('validateOrg and cutAtContact', () => {
  const v = validateOrg({ name: 'Test Food Bank', kind: 'charity', description: 'Feeds families. Call 514-555-0100', city: 'Montreal', confidence: 0.9, people: ['x'] });
  assert.deepEqual(v.value, { conf: 0.9, name: 'Test Food Bank', kind: 'charity', description: 'Feeds families. Call', city: 'Montreal' });
  assert.equal(validateOrg({ name: 'X', confidence: 2 }).value, null);
  assert.equal(validateOrg({ confidence: 0.5 }).value, null);
  assert.equal(cutAtContact('Visit www.example.org now').text, 'Visit');
  assert.equal(cutAtContact('Plain words').cut, false);
});

test('safeHost refuses private, loopback, link-local, CGNAT, unique-local ranges and any port but 443', () => {
  for (const ip of ['10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '127.0.0.1', '169.254.169.254', '100.64.0.1', '100.127.255.255', '0.0.0.0', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', '::ffff:10.0.0.1', 'not-an-ip']) {
    assert.equal(safeHost(ip, 443), false, ip);
  }
  assert.equal(safeHost('93.184.216.34', 443), true);
  assert.equal(safeHost('2606:2800:220:1:248:1893:25c8:1946', 443), true);
  assert.equal(safeHost('93.184.216.34', 80), false);
  assert.equal(safeHost('93.184.216.34', 8443), false);
  assert.equal(safeHost('172.32.0.1', 443), true, 'just outside 172.16/12');
  assert.equal(isPrivateIp('100.128.0.1'), false, 'just outside 100.64/10');
});

test('robots.txt and registered domains', () => {
  assert.equal(robotsRefuses('User-agent: *\nDisallow: /'), true);
  assert.equal(robotsRefuses('User-agent: *\nDisallow: /private'), false);
  assert.equal(robotsRefuses('User-agent: WelfareAvenueHub\nDisallow: /\n\nUser-agent: *\nAllow: /'), true);
  assert.equal(robotsRefuses('User-agent: OtherBot\nDisallow: /\n\nUser-agent: *\nDisallow:'), false);
  assert.equal(registeredDomain('www.org.example.org'), 'example.org');
  assert.equal(registeredDomain('a.ville.qc.ca'), 'ville.qc.ca');
});
