/* crm1ui_email_worst.js: the worst-case drive for wave293 (the email history on a contact's page and the CRM's Insights tab).
   Dev only: the data goes in through the same window.__WAFIX boundary as every drive (test/boot.js and test/w293fx.js), never through the
   page. Invented people only. It checks:
   - the timeline groups a thread ("Email thread: <first subject>", "3 emails, 12 Mar to 2 Apr 2021", the latest line, Show the emails),
     one email stays one item, the by line names the mailboxes, Open in Gmail only for Steel and only on his mailbox's items, no Delete on
     an email item, the filters by kind and the topics under Emails, an open thread stays open when the sheet repaints, Show more;
   - the Relationship card: the type and how sure (or Not sure, and May be out of date), the counts in words (singular and plural), the
     topics, anything open, the summary, Written by the Hub on, Refresh through mail-history insight (and its refusal in the function's words),
     the admins-only note for lines from Steel's mailbox; a CRM member reads no line from Steel's mailbox (row security, as the fixture gives);
   - the Insights tab: the three sections from a stubbed crm_insights_overview(), singulars, the top 25 of N, the period switch, a quiet name
     opens the contact, the empty states, the note on Steel's mailbox for an admin and for a member, a board viewer kept out;
   - at 1366, 390 and 320 px and at 200% zoom: nothing past the screen, nothing spilling out of its box, 44px targets on a phone, tabular
     numbers, no page errors.
   usage: WA_DATA=demo|worst|empty|one|huge|all [WIDTHS=1366,390,320] [WA_ZOOM=1] [WA_SHOTS=<folder>] [JOBS=profile,member,insights,roles] node test/crm1ui_email_worst.js */
const fs = require('fs'), path = require('path');
const { launch, fresh } = require('./boot');
const { fixture, INVOKE, LONG } = require('./w293fx');
const SETS = (process.env.WA_DATA || 'worst') === 'all' ? ['demo', 'worst', 'empty', 'one', 'huge'] : (process.env.WA_DATA || 'worst').split(',');
const WIDTHS = (process.env.WIDTHS || '1366,390,320').split(',').map(Number);
const ZOOM = !!process.env.WA_ZOOM, SHOTS = process.env.WA_SHOTS || '';
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }

const RPCS = (who, X) => ({ wa_org_editor: who === 'admin', crm_age_band: null, wa_my_caps: who === 'admin' ? { gifts_edit: true, import_admin: true, hr_private: true } : {}, crm_insights_overview: X.overview });
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; try { el.focus(); } catch (e) { /* fine */ } el.click(); return true; }, s);   /* a pointer press focuses the button first, as Chrome does */
function probe(f, root) {
  return f.ev((root) => {
    const R = document.querySelector(root) || document.body, iw = innerWidth, sw = document.documentElement.scrollWidth;
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const nm = e => (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : e.tagName.toLowerCase());
    const all = [...R.querySelectorAll('*')].filter(vis);
    const wide = all.filter(e => e.getBoundingClientRect().right > iw + 1 && !e.closest('.w152tabs')).map(e => nm(e) + '>' + Math.round(e.getBoundingClientRect().right));
    const spill = all.filter(e => { const cs = getComputedStyle(e); return e.scrollWidth > e.clientWidth + 2 && cs.overflowX === 'visible' && cs.display !== 'inline' && e.tagName !== 'svg' && e.tagName !== 'SELECT' && !e.closest('.w152tabs'); }).map(e => nm(e) + ':' + e.scrollWidth + '/' + e.clientWidth);
    return { side: sw > iw + 1, wide: wide.slice(0, 5), spill: spill.slice(0, 5) };
  }, root);
}
async function fits(f, root, label) { const p = await probe(f, root); ok(label + ': nothing past the screen and nothing spills out of its box', !p.side && !p.wide.length && !p.spill.length, p); }
async function shot(f, name) { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await f.page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false }); }
async function boot(browser, D, who, w, hash) {
  const X = fixture(D, who);
  const f = await fresh(browser, { who, width: ZOOM ? 683 : w, height: ZOOM ? 450 : undefined, hash: '#mypage', fixture: X.fx, rpcs: RPCS(who, X), init: INVOKE, wait: 3500 });
  await f.hash(hash, 2000); await f.page.mouse.move((ZOOM ? 683 : w) - 5, 300);
  return { f, X };
}
const tagOf = (D, w, extra) => D + ' ' + (ZOOM ? 'zoom200' : w) + (extra ? ' ' + extra : '');
const sheetState = f => f.ev(() => {
  const s = document.getElementById('w152sheet'); if (!s) return null;
  const card = s.querySelector('[data-w293card]');
  return {
    items: [...s.querySelectorAll('.w152tl > li')].map(li => ({ mail: li.classList.contains('w293mail'), t: (li.querySelector('.t') || {}).innerText || '', span: (li.querySelector('.w293span') || {}).innerText || '', by: (li.querySelector('.by') || {}).innerText || '',
      gmail: !!li.querySelector('[data-w293gmail]'), del: !!li.querySelector('[data-w152delint]'), det: !!li.querySelector('details[data-w293det]'), p: (li.querySelector(':scope > div > p') || {}).innerText || '' })),
    chips: [...s.querySelectorAll('.w293chips:not(.sub) .w293chip')].map(b => b.innerText.replace(/\s+/g, ' ').trim()),
    topics: [...s.querySelectorAll('.w293chips.sub .w293chip')].map(b => b.innerText.replace(/\s+/g, ' ').trim()),
    card: card ? card.innerText.replace(/\s+/g, ' ').trim() : null, counts: (s.querySelector('[data-w293counts]') || {}).innerText || '', adm: !!s.querySelector('[data-w293adm]'),
    more: (s.querySelector('[data-w293more]') || {}).innerText || '', msg: (s.querySelector('.w293msg') || {}).innerText || ''
  };
});

async function profile(browser, D, w) {
  const tag = tagOf(D, w, 'admin');
  const { f, X } = await boot(browser, D, 'admin', w, '#crm');
  await f.hash('#crm/c/' + X.ids.who, 1800);
  let s = await sheetState(f);
  const mails = s.items.filter(x => x.mail);
  ok(tag + ': no Delete on an email item', mails.every(x => !x.del), mails);
  ok(tag + ': Open in Gmail shows for Steel only on his mailbox\'s items', mails.filter(x => x.gmail).length === mails.filter(x => /Steel’s mailbox/.test(x.by)).length && mails.every(x => !x.gmail || /Steel’s mailbox/.test(x.by)), mails.map(x => [x.by, x.gmail]));
  if (D === 'demo') {
    const th = mails.filter(x => x.det)[0] || {};
    ok(tag + ': a thread reads "Email thread: <first subject>" with "3 emails, 12 Mar to 2 Apr 2021" and its latest line', /^Email thread: Food drive partnership/.test(th.t) && th.span === '3 emails, 12 Mar to 2 Apr 2021' && /Confirms the date/.test(th.p), th);
    ok(tag + ': the thread names both mailboxes', /^From hub@ and info@/.test(th.by), th.by);
    const one = mails.filter(x => !x.det)[0] || {};
    ok(tag + ': one email stays one item ("Email from them: ...") from Steel\'s mailbox, admins only for now', /^Email from them: Board introduction/.test(one.t) && /From Steel’s mailbox · admins only for now/.test(one.by) && one.gmail, one);
    ok(tag + ': the filter chips: All, Emails, Notes and calls, Gifts, with counts', JSON.stringify(s.chips) === JSON.stringify(['All 4', 'Emails 2', 'Notes and calls 1', 'Gifts 1']), s.chips);
    ok(tag + ': the Relationship card: Partner, 86% sure; the counts; topics; still open; the summary; written on; Refresh', /^Relationship Partner, 86% sure/i.test(s.card) && s.counts === 'First email 12 Mar 2021, last 14 Aug 2026, 4 emails in 2 threads' &&
      /Partnerships/.test(s.card) && /Still open They are waiting for a date/.test(s.card) && /A partner since the 2021/.test(s.card) && /Written by the Hub on 20 Sep 2026 Refresh about 1¢/.test(s.card), s.card);
    ok(tag + ': the admins-only note for lines from Steel\'s mailbox', s.adm);
    /* the filters: Emails, then a topic, then All again */
    await click(f, '#w152sheet [data-w293tlf="email"]'); await f.page.waitForTimeout(250);
    s = await sheetState(f);
    ok(tag + ': Emails shows the two email items and the topics under it', s.items.length === 2 && s.items.every(x => x.mail) && JSON.stringify(s.topics) === JSON.stringify(['Every topic', 'Partnerships 2', 'Events 1']), s);
    ok(tag + ': the pressed chip keeps the focus after the repaint', await f.ev(() => (document.activeElement || {}).getAttribute && document.activeElement.getAttribute('data-w293tlf') === 'email'));
    await click(f, '#w152sheet [data-w293tlt="event"]'); await f.page.waitForTimeout(250);
    s = await sheetState(f);
    ok(tag + ': a topic narrows to the threads holding it', s.items.length === 1 && s.items[0].det, s.items);
    await f.ev(() => { const d = document.querySelector('#w152sheet details[data-w293det]'); d.open = true; }); await f.page.waitForTimeout(200);
    const em = await f.ev(() => [...document.querySelectorAll('#w152sheet details[data-w293det] .w293list > li')].map(li => li.innerText.replace(/\s+/g, ' ').trim()));
    ok(tag + ': Show the emails lists each one: date, from or to them, mailbox, line', em.length === 3 && /^12 Mar 2021 From them hub@ Asks whether/.test(em[0]) && /^15 Mar 2021 To them info@ Says yes/.test(em[1]), em);
    if (!ZOOM) await shot(f, 'profile-thread-open-' + D + '-' + w);
    await click(f, '#w152sheet [data-w293tlt=""]'); await f.page.waitForTimeout(250);
    ok(tag + ': an open thread stays open when the sheet repaints', await f.ev(() => !!document.querySelector('#w152sheet details[data-w293det][open]')));
    await click(f, '#w152sheet [data-w293tlf=""]'); await f.page.waitForTimeout(250);
    s = await sheetState(f);
    ok(tag + ': All brings everything back', s.items.length === 4, s.items.length);
    /* Refresh: mail-history insight, then its refusal in the function's words */
    await click(f, '#w152sheet [data-w293refresh]'); await f.page.waitForTimeout(700);
    let inv = await f.ev(() => window.__inv.filter(x => x.name === 'mail-history'));
    s = await sheetState(f);
    ok(tag + ': Refresh calls mail-history insight for the contact and says Summary written.', inv.length === 1 && inv[0].body.action === 'insight' && inv[0].body.contact_id === X.ids.who && s.msg === 'Summary written.', { inv, msg: s.msg });
    await f.ev(() => { window.__INSIGHT_ERR = 'Only admins refresh summaries from Steel\'s mailbox for now.'; });
    await click(f, '#w152sheet [data-w293refresh]'); await f.page.waitForTimeout(700);
    s = await sheetState(f);
    ok(tag + ': a refused Refresh says why, in the function\'s words', s.msg === 'Only admins refresh summaries from Steel\'s mailbox for now.', s.msg);
  }
  if (D === 'worst' || D === 'huge') {
    ok(tag + ': a low confidence says Not sure (perhaps supplier) and May be out of date', /^Relationship Not sure \(perhaps supplier\) May be out of date/i.test(s.card || ''), s.card);
    const t40 = mails.filter(x => /^Email thread: Weekly volunteer group/.test(x.t))[0] || {};
    ok(tag + ': a 40-email thread says "40 emails, ..." in one item', /^40 emails, \d+ \w{3} to \d+ \w{3} 2022$/.test(t40.span), t40);
    ok(tag + ': an email with no subject reads "Email from them"', mails.some(x => /^Email from them\s*\d/.test(x.t)), mails.map(x => x.t.slice(0, 30)));
    if (D === 'huge') {
      ok(tag + ': a huge history shows 50 items and Show 50 more', s.items.length === 50 && /^Show 50 more \([\d,]+ left\)$/.test(s.more), { n: s.items.length, more: s.more });
      ok(tag + ': the timeline says it shows the latest 600 of 1,047 emails (eh-293 A-M3)', await f.ev(() => (document.querySelector('#w152sheet [data-w293cut]') || {}).textContent === 'The timeline shows the latest 600 of 1,047 emails.'));
      await click(f, '#w152sheet [data-w293more]'); await f.page.waitForTimeout(400);
      ok(tag + ': Show more adds 50', (await sheetState(f)).items.length === 100);
    }
  }
  if (D === 'one') {
    ok(tag + ': one email: "One email, 12 Mar 2021", one item, no thread', s.counts === 'One email, 12 Mar 2021' && mails.length === 1 && !mails[0].det && /^Email from them: Hello/.test(mails[0].t), { counts: s.counts, mails });
    ok(tag + ': 100% sure for a certain type', /Partner, 100% sure/.test(s.card || ''), s.card);
  }
  if (D === 'empty') ok(tag + ': no email history: no Relationship card and no Emails chip', s.card === null && !s.chips.some(c => /^Emails/.test(c)), s);
  await fits(f, '#w152sheet', tag + ' contact');
  await shot(f, 'profile-' + D + '-' + (ZOOM ? 'zoom200' : w));
  if (w < 700 && !ZOOM) {
    const small = await f.ev(() => [...document.querySelectorAll('#w152sheet .w293chip,#w152sheet .w293em summary,#w152sheet [data-w293refresh],#w152sheet [data-w293gmail],#w152sheet [data-w293more]')].filter(e => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 44).map(e => e.innerText.trim().slice(0, 20) + ':' + Math.round(e.getBoundingClientRect().height)));
    ok(tag + ': phone targets are 44px (chips, Show the emails, Refresh, Open in Gmail, Show more)', small.length === 0, small);
  }
  const tab = await f.ev(() => { const e = document.querySelector('#w152sheet .w293span,#w152sheet [data-w293counts]'); return e ? getComputedStyle(e).fontVariantNumeric : 'none'; });
  if (D !== 'empty') ok(tag + ': counts and spans use tabular numbers', /tabular-nums/.test(tab), tab);
  ok(tag + ': profile: no page errors', f.errs.length === 0, f.errs);
  await f.close();
}

async function member(browser, D, w) {
  if (D === 'empty') return;
  const tag = tagOf(D, w, 'member');
  const { f, X } = await boot(browser, D, 'member', w, '#crm');
  await f.hash('#crm/c/' + X.ids.who, 1800);
  const s = await sheetState(f);
  const mails = s.items.filter(x => x.mail);
  ok(tag + ': a member reads no line from Steel\'s mailbox and sees no Open in Gmail', mails.every(x => !/Steel’s mailbox/.test(x.by) && !x.gmail), mails);
  ok(tag + ': no admins-only note for a member', !s.adm);
  ok(tag + ': no Delete on an email item for a member', mails.every(x => !x.del));
  if (D === 'demo') {
    ok(tag + ': the summary marked from Steel\'s mailbox is not shown; the card offers Write one', s.card && /No summary yet\. Write one/.test(s.card) && !/A partner since/.test(s.card), s.card);
    await f.ev(() => { window.__INSIGHT_NONE = true; });
    await click(f, '#w152sheet [data-w293refresh]'); await f.page.waitForTimeout(700);
    const m = await sheetState(f);
    ok(tag + ': Write one answers one neutral line and the sheet never names Steel\'s mailbox (eh-293 A-I1)', m.msg === 'Nothing to summarise yet.' && !/Steel/.test(await f.ev(() => document.getElementById('w152sheet').innerText)), m.msg);
  }
  await fits(f, '#w152sheet', tag + ' contact');
  if (D === 'demo' || D === 'worst') await shot(f, 'profile-member-' + D + '-' + (ZOOM ? 'zoom200' : w));
  ok(tag + ': member: no page errors', f.errs.length === 0, f.errs);
  await f.close();
}

const insightsState = f => f.ev(() => {
  const r = document.getElementById('w293root'); if (!r) return null;
  const sec = k => r.querySelector('[data-w293sec="' + k + '"]');
  return {
    tab: !!document.querySelector('#crm .w152tabs [data-w152go="#crm/insights"].on'), note: (r.querySelector('[data-w293note]') || {}).innerText || '',
    years: [...r.querySelectorAll('.w293yr')].map(y => y.getAttribute('aria-label')), legend: [...r.querySelectorAll('.w293lg li')].map(l => l.innerText.trim()),
    types: sec('types') ? sec('types').innerText.replace(/\s+/g, ' ') : '', orgsSub: sec('orgs') ? (sec('orgs').querySelector('.w293sub') || {}).innerText || '' : '',
    orgs: [...r.querySelectorAll('.w293orgs > li')].map(li => li.innerText.replace(/\s+/g, ' ').trim()), orgsTxt: sec('orgs') ? sec('orgs').innerText.replace(/\s+/g, ' ') : '',
    quietSub: sec('quiet') ? (sec('quiet').querySelector('.w293sub') || {}).innerText || '' : '', quiet: [...r.querySelectorAll('.w293quiet > li')].map(li => li.innerText.replace(/\s+/g, ' ').trim()),
    quietTxt: sec('quiet') ? sec('quiet').innerText.replace(/\s+/g, ' ') : '', text: r.innerText.replace(/\s+/g, ' ')
  };
});

async function insights(browser, D, w) {
  const tag = tagOf(D, w, 'insights');
  const { f, X } = await boot(browser, D, 'admin', w, '#crm/insights');
  await f.page.waitForTimeout(400);
  let s = await insightsState(f);
  ok(tag + ': the Insights tab is drawn and marked', s && s.tab, s && s.tab);
  if (!s) { await f.close(); return; }
  ok(tag + ': an admin is told the team does not see Steel\'s mailbox yet', /^You see Steel’s mailbox in these counts; the rest of the team does not until he opens it\.$/.test(s.note), s.note);
  if (D === 'demo') {
    ok(tag + ': one bar a year from 2020 to 2026', s.years.length === 7 && /^2020: /.test(s.years[0]) && /^2026: /.test(s.years[6]), s.years);
    ok(tag + ': a year says its people by type', s.years[1] === '2021: 11 people (5 partners, 4 volunteers, 2 not typed)', s.years[1]);
    ok(tag + ': the legend lists the types in use', JSON.stringify(s.legend) === JSON.stringify(['Partners', 'Donors', 'Volunteers', 'Supporters', 'Government', 'Media', 'Not typed']), s.legend);
    ok(tag + ': the organisations, all time, with relationship and status', s.orgs.length === 2 && /^1 Test Food Bank Partner Active last email 14 Aug 2026 5 people 42 emails$/.test(s.orgs[0]), s.orgs);
    await click(f, '#w293root [data-w293sort="12"]'); await f.page.waitForTimeout(200);
    s = await insightsState(f);
    ok(tag + ': Last 12 months is ranked on its own: an organisation outside the all-time list comes first, and who did not write this year is gone (eh-293 A-M1)', s.orgs.length === 2 && /^1 Test Youth Centre/.test(s.orgs[0]) && / 2 people 6 emails$/.test(s.orgs[1]), s.orgs);
    ok(tag + ': the period switch keeps the focus', await f.ev(() => (document.activeElement || {}).getAttribute && document.activeElement.getAttribute('data-w293sort') === '12'));
    ok(tag + ': gone quiet: two people, the gift named, how long ago', s.quiet.length === 2 && /^Bea Testdonor Donor Last gift 14 Feb 2025 \(\d+ months ago\)$/.test(s.quiet[0]) && /Last on their timeline 2 Nov 2024/.test(s.quiet[1]) && /for a year or more: 2 people, the most recent first\.$/.test(s.quietSub), { q: s.quiet, sub: s.quietSub });
    ok(tag + ': no waiting-on-a-reply list', !/waiting on a reply/i.test(s.text));
    await click(f, '#w293root [data-w152open="7101"]'); await f.page.waitForTimeout(1200);
    ok(tag + ': a quiet name opens the contact', await f.ev(() => { const s = document.getElementById('w152sheet'); return !!s && s.style.display !== 'none' && /Bea Testdonor/.test((s.querySelector('h2') || {}).textContent || ''); }));
    await click(f, '#w152sheet [data-w152close]'); await f.page.waitForTimeout(300);
  }
  if (D === 'one') {
    ok(tag + ': singulars: "1 person (1 partner)", "1 person 1 email", "1 person"', s.years[1] === '2021: 1 person (1 partner)' && / 1 person 1 email$/.test(s.orgs[0] || '') && /: 1 person, the most recent first\.$/.test(s.quietSub), { y: s.years, o: s.orgs, q: s.quietSub });
    ok(tag + ': a year with nobody says nobody', s.years[0] === '2020: nobody', s.years[0]);
  }
  if (D === 'empty') {
    ok(tag + ': empty: each section says what will fill it', /No email history yet\./.test(s.types) && /No organisation is linked/.test(s.orgsTxt) && /Nobody has gone quiet\. Everyone with history has heard from us, or we from them, in the last year\./.test(s.quietTxt), s.text.slice(0, 600));
    ok(tag + ': empty: the period reads "in the last year"-style words, not "last a year"', !/last a year/.test(s.quietTxt), s.quietTxt);
  }
  if (D === 'huge') {
    ok(tag + ': huge: the top 25 of 600, and 1,284 quiet people with the 100 most recent', /the top 25 of 600\.$/.test(s.orgsSub) && s.orgs.length === 25 && /18 months or more: 1,284 people, the 100 who went quiet most recently first\.$/.test(s.quietSub) && s.quiet.length === 100, { o: s.orgsSub, q: s.quietSub, n: s.quiet.length });
    ok(tag + ': huge: twelve thousand emails read 12,840 and a million reads 1,000,000', /12,840 emails/.test(s.orgsTxt) && /1,000,000 emails/.test(s.orgsTxt), s.orgsTxt.slice(0, 300));
  }
  if (D === 'worst') ok(tag + ': worst: the long organisation and the emoji names are there whole', s.orgsTxt.indexOf(LONG.org) >= 0 && /🦊 Fox Liang/.test(s.quietTxt), s.orgsTxt.slice(0, 200));
  const nums = await f.ev(() => [...document.querySelectorAll('#w293root .w293n,#w293root .w293m b')].slice(0, 3).map(e => getComputedStyle(e).fontVariantNumeric));
  if (nums.length) ok(tag + ': numbers are tabular', nums.every(n => /tabular-nums/.test(n)), nums);
  await fits(f, '#crm', tag);
  await shot(f, 'insights-' + D + '-' + (ZOOM ? 'zoom200' : w));
  if (w < 700 && !ZOOM) {
    const small = await f.ev(() => [...document.querySelectorAll('#w293root .w293btn,#w293root .w293seg button,#w293root .w293lnk,#w293root .w293row')].filter(e => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 44).map(e => e.innerText.trim().slice(0, 20) + ':' + Math.round(e.getBoundingClientRect().height)));
    ok(tag + ': phone targets are 44px (Refresh, the period switch, organisations, quiet names)', small.length === 0, small);
  }
  ok(tag + ': insights: no page errors', f.errs.length === 0, f.errs);
  await f.close();
}

/* the roles: a member's note, a board viewer kept out, a refused overview, the rail item */
async function roles(browser, D, w) {
  if (D !== 'demo') return;
  const tag = tagOf(D, w, 'roles');
  let { f } = await boot(browser, D, 'member', w, '#crm/insights');
  let s = await insightsState(f);
  ok(tag + ': a member is told some history is for admins, never whose (eh-293 A-I1, A-M2)', s && s.note === 'Some email history is visible to admins only for now, so these counts can leave people out.' && !/Steel/.test(s.text) && /someone may look quiet who is not\.$/.test(s.quietSub), s && [s.note, s.quietSub]);
  await f.ev(() => { window.w293.state().data = { allowed: false }; window.w293.paint(); });
  ok(tag + ': an overview that says not allowed says Insights are for the team with the CRM', await f.ev(() => /Insights are for the Welfare Avenue team with the CRM\./.test(document.getElementById('w293root').innerText)));
  await f.ev(() => { const S = window.w293.state(); S.data = null; S.err = 'permission denied'; window.w293.paint(); });
  ok(tag + ': a failed overview says so and offers Try again', await f.ev(() => /could not be worked out \(permission denied\)\. Try again/.test(document.getElementById('w293root').innerText.replace(/\s+/g, ' '))));
  ok(tag + ': member roles: no page errors', f.errs.length === 0, f.errs);
  await f.close();
  ({ f } = await boot(browser, D, 'board', w, '#crm/insights'));
  const b = await f.ev(() => ({ root: !!document.getElementById('w293root'), text: ((document.querySelector('#crm .w152root') || {}).innerText || '').trim() }));
  ok(tag + ': a board viewer gets no Insights', !b.root, b);
  await f.close();
  ({ f } = await boot(browser, D, 'admin', w, '#crm/insights'));
  const rail = await f.ev(() => [...document.querySelectorAll('#w153rail [data-w153go]')].map(a => a.getAttribute('data-w153go')));
  if (rail.length) ok(tag + ': the rail lists Insights after Reports', rail.indexOf('#crm/insights') === rail.indexOf('#crm/reports') + 1, rail);
  const seg = fs.readFileSync(path.join(__dirname, '../build/src/MANIFEST.txt'), 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#'));
  ok(tag + ': segment 293 comes right after 284 in the manifest', seg.indexOf('293_wave293') === seg.indexOf('284_wave284') + 1);
  ok(tag + ': admin roles: no page errors', f.errs.length === 0, f.errs);
  await f.close();
}

(async () => {
  const browser = await launch();
  if (ZOOM) { const nc = browser.newContext.bind(browser); browser.newContext = o => nc(Object.assign({}, o, { isMobile: false, hasTouch: false, deviceScaleFactor: 2 })); }
  const jobs = (process.env.JOBS || 'profile,member,insights,roles').split(',');
  const J = { profile, member, insights, roles };
  for (const D of SETS) for (const w of (ZOOM ? [683] : WIDTHS)) for (const j of jobs) {
    try { await J[j](browser, D, w); } catch (e) { fail++; out.push('FAIL ' + D + ' ' + w + ' ' + j + ' crashed: ' + String(e && e.stack || e).slice(0, 400)); }
  }
  await browser.close();
  console.log(out.join('\n'));
  console.log('\ncrm1ui_email_worst: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
