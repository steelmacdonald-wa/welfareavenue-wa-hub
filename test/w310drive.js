/* wave306: the Content Studio's five areas, Today and Results > Website.
   node test/w306drive.js [shots dir]  (candidate: build/candidate.html) */
const { launch, fresh } = require('./boot');
const OUT = process.argv[2] || '/tmp/shots';
function report(from, to) {
  const days = []; let d = new Date(from + 'T12:00:00Z'); const end = new Date(to + 'T12:00:00Z');
  let i = 0; while (d <= end) { const s = 8 + Math.round(6 * Math.sin(i / 3) + (i % 7 === 5 ? 9 : 0)); days.push({ day: d.toISOString().slice(0, 10), users: s, sessions: s + 2, engaged: Math.round(s * 0.45), views: s * 2 }); d = new Date(d.getTime() + 864e5); i++; }
  const ses = days.reduce((a, x) => a + x.sessions, 0), eng = days.reduce((a, x) => a + x.engaged, 0);
  return { ok: true, property: '426291717', site: 'https://welfareavenue.com/', from, to, prev: { from: '2026-07-01', to: '2026-08-28' }, made_at: new Date().toISOString(), cached: true, consent_since: '2026-11-10', events_since: '2026-09-01',
    totals: { cur: { totalUsers: Math.round(ses * 0.85), newUsers: Math.round(ses * 0.8), sessions: ses, engagedSessions: eng, engagementRate: eng / ses, userEngagementDuration: eng * 95, averageSessionDuration: 80, screenPageViews: ses * 2, eventCount: ses * 5 },
              prev: { totalUsers: Math.round(ses * 0.7), newUsers: 300, sessions: Math.round(ses * 0.8), engagedSessions: Math.round(eng * 0.7), engagementRate: 0.3, userEngagementDuration: eng * 70, averageSessionDuration: 90, screenPageViews: ses, eventCount: ses * 4 } },
    daily: days,
    channels: { cur: [['Direct', 0.45, 0.18], ['Organic Search', 0.25, 0.65], ['Organic Social', 0.12, 0.5], ['Referral', 0.08, 0.6], ['Paid Search', 0.05, 0.58], ['Email', 0.05, 0.7]].map(([k, sh, er]) => ({ sessionDefaultChannelGroup: k, sessions: Math.round(ses * sh), engagedSessions: Math.round(ses * sh * er), totalUsers: Math.round(ses * sh * 0.9), userEngagementDuration: 500 })),
                prev: [{ sessionDefaultChannelGroup: 'Direct', sessions: Math.round(ses * 0.4) }, { sessionDefaultChannelGroup: 'Organic Search', sessions: Math.round(ses * 0.2) }, { sessionDefaultChannelGroup: 'Organic Social', sessions: Math.round(ses * 0.05) }] },
    sources: [{ sessionSource: '(direct)', sessionMedium: '(none)', sessions: 120, engagedSessions: 22, totalUsers: 110 }, { sessionSource: 'google', sessionMedium: 'organic', sessions: 70, engagedSessions: 45, totalUsers: 60 }, { sessionSource: 'instagram.com', sessionMedium: 'referral', sessions: 30, engagedSessions: 15, totalUsers: 28 }, { sessionSource: 'l.instagram.com', sessionMedium: 'referral', sessions: 12, engagedSessions: 6, totalUsers: 10 }],
    campaigns: [{ sessionCampaignName: 'onebag-launch', sessionSource: 'instagram', sessions: 22, engagedSessions: 14, totalUsers: 20 }, { sessionCampaignName: 'SK-SearchBranded-AOF-Traffic-EN-CAN', sessionSource: 'google', sessions: 11, engagedSessions: 7, totalUsers: 8 }],
    landing: [{ landingPage: '/', sessions: 160, engagedSessions: 60, userEngagementDuration: 7000, totalUsers: 150 }, { landingPage: '/gift-basket-drive/', sessions: 60, engagedSessions: 44, userEngagementDuration: 6200, totalUsers: 55 }, { landingPage: '/cart-page', sessions: 30, engagedSessions: 0, userEngagementDuration: 0, totalUsers: 30 }, { landingPage: '/volunteer/', sessions: 25, engagedSessions: 12, userEngagementDuration: 1100, totalUsers: 22 }, { landingPage: '/fr/', sessions: 14, engagedSessions: 6, userEngagementDuration: 500, totalUsers: 12 }],
    pages: [{ pagePath: '/', pageTitle: 'Welfare Avenue', screenPageViews: 300, totalUsers: 200, userEngagementDuration: 9000 }, { pagePath: '/gift-basket-drive/', pageTitle: 'Holiday Gift Basket Drive 2026, Montreal · Welfare Avenue', screenPageViews: 120, totalUsers: 80, userEngagementDuration: 8400 }, { pagePath: '/volunteer/', pageTitle: 'Volunteer · Welfare Avenue', screenPageViews: 60, totalUsers: 40, userEngagementDuration: 2000 }],
    events: { cur: [{ eventName: 'donate_click', eventCount: 34, totalUsers: 25, eventValue: 1650 }, { eventName: 'form_sent', eventCount: 9, totalUsers: 9 }, { eventName: 'newsletter_signup', eventCount: 6, totalUsers: 6 }, { eventName: 'signup_open', eventCount: 21, totalUsers: 18 }, { eventName: 'scroll', eventCount: 200, totalUsers: 150 }], prev: [{ eventName: 'donate_click', eventCount: 20 }] },
    devices: [{ deviceCategory: 'mobile', totalUsers: 220, sessions: 260, engagementRate: 0.52 }, { deviceCategory: 'desktop', totalUsers: 160, sessions: 190, engagementRate: 0.31 }, { deviceCategory: 'tablet', totalUsers: 6, sessions: 6, engagementRate: 0.4 }],
    returning: [{ newVsReturning: 'new', totalUsers: 330 }, { newVsReturning: 'returning', totalUsers: 56 }],
    places: [{ city: 'Montreal', country: 'Canada', totalUsers: 150, sessions: 190 }, { city: 'Singapore', country: 'Singapore', totalUsers: 120, sessions: 120 }, { city: 'Toronto', country: 'Canada', totalUsers: 40, sessions: 44 }, { city: 'Laval', country: 'Canada', totalUsers: 18, sessions: 20 }],
    donate: [{ campaign: 'gift-basket-drive', clicks: 24, people: 18, value: 1300 }, { campaign: 'general', clicks: 10, people: 8, value: 350 }],
    forms: [{ event: 'signup_open', form: 'benevole,volunteer', count: 14, people: 12 }, { event: 'form_sent', form: 'benevole,volunteer', count: 6, people: 6 }, { event: 'form_sent', form: 'gift-drive-volunteer', count: 3, people: 3 }, { event: 'newsletter_signup', form: 'infolettre,newsletter', count: 6, people: 6 }],
    actions_daily: days.filter((x, j) => j % 4 === 1).map(x => ({ day: x.day, event: 'donate_click', count: 2 })),
    outbound: [],
    clicks: [{ event: 'donate_click', text: 'Give $50', area: 'gift-ladder', page: '/gift-basket-drive/', count: 14, people: 11 }, { event: 'link_click', text: 'Volunteer', area: 'menu', page: '/', count: 12, people: 10 }, { event: 'signup_open', text: 'Sign up to volunteer', area: 'apply', page: '/volunteer/', count: 9, people: 8 }, { event: 'donate_click', text: 'Donate', area: 'menu', page: '/', count: 8, people: 8 }, { event: 'link_click', text: 'Instagram', area: 'footer', page: '/', count: 4, people: 4 }, { event: 'language_switch', text: 'Français', area: 'menu', page: '/', count: 3, people: 3 }],
    scroll: [['/', 25, 120], ['/', 50, 60], ['/', 75, 30], ['/', 100, 18], ['/gift-basket-drive/', 25, 70], ['/gift-basket-drive/', 50, 55], ['/gift-basket-drive/', 75, 40], ['/gift-basket-drive/', 100, 32], ['/volunteer/', 25, 30], ['/volunteer/', 50, 9], ['/volunteer/', 75, 4], ['/volunteer/', 100, 2]].map(([page, pct, people]) => ({ page, pct, people })),
    sections: [{ page: '/', section: 'hero', people: 190 }, { page: '/', section: 'impact', people: 60 }, { page: '/', section: 'partners', people: 20 }, { page: '/gift-basket-drive/', section: 'gift-ladder', people: 60 }, { page: '/gift-basket-drive/', section: 'faq', people: 12 }],
    paths: [{ from: '/', to: '/volunteer/', views: 40 }, { from: '/', to: '/gift-basket-drive/', views: 33 }, { from: '/gift-basket-drive/', to: '/donate/', views: 12 }, { from: '/volunteer/', to: '/join/', views: 7 }, { from: '/', to: '/about/', views: 6 }],
    page_people: [{ page: '/', people: 200 }, { page: '/gift-basket-drive/', people: 80 }, { page: '/volunteer/', people: 40 }],
    errors: [] };
}

function clar(connected) {
  if (!connected) return { ok: true, connected: false, days: 28, day_count: 0, overall: {}, pages: {} };
  const P = (v, sd, r, d, q) => ({ Traffic: { totalSessionCount: v }, ScrollDepth: { averageScrollDepth: sd }, RageClickCount: { subTotal: r }, DeadClickCount: { subTotal: d }, QuickbackClick: { subTotal: q } });
  return { ok: true, connected: true, days: 28, from: '2026-11-12', to: '2026-11-14', day_count: 3, last_pull: new Date().toISOString(),
    overall: { Traffic: { totalSessionCount: 84, totalBotSessionCount: 12 }, ScrollDepth: { averageScrollDepth: 47.4 }, RageClickCount: { subTotal: 6, sessionsWithMetricPercentage: 7.1 }, DeadClickCount: { subTotal: 19, sessionsWithMetricPercentage: 18 }, QuickbackClick: { subTotal: 5, sessionsWithMetricPercentage: 6 }, EngagementTime: { activeTime: 84 * 41 } },
    pages: { '/gift-basket-drive/': P(40, 52, 4, 9, 1), '/': P(20, 35, 0, 2, 3), '/volunteer/': P(10, 60, 2, 5, 1), '/fr/benevolat/': P(4, 70, 0, 0, 0) } };
}
(async () => {
  const browser = await launch();
  const results = [];
  const check = (name, ok, info) => { const l = (ok ? 'PASS ' : 'FAIL ') + name + (info ? ' (' + info + ')' : ''); results.push(l); console.log(l); };
  for (const [label, width, connected] of [['desk', 1366, true], ['phone', 390, true], ['desk_nolink', 1366, false]]) {
    const f = await fresh(browser, { who: 'admin', width, hash: '#studio/web', beforeGoto: async (pg) => { pg.setDefaultNavigationTimeout(180000); pg.setDefaultTimeout(180000); }, rpcs: { wa_org_editor: true, wa225_publisher: true, wa225_marketing: true, www_campaign_totals: { goal: 5000, name: 'Holiday Gift Basket Drive 2026', open: true, slug: 'gift-basket-drive', gifts: 1, donors: 1, raised: 750, gifts_in: 616, gift_goal: 6000 } },
      init: `window.__WA_INVOKE = function (name, opts) { var b = (opts && opts.body) || {}; if (name === 'clarity-insights') return { data: (${clar.toString()})(${connected}), error: null }; if (name === 'web-insights') { if (b.action === 'realtime') return { data: { ok: true, active: 3, pages: [] }, error: null }; return new Promise(function (res) { setTimeout(function () { res({ data: (${report.toString()})(b.from, b.to), error: null }); }, 350); }); } return { data: null, error: null }; };` });
    const { page } = f;
    await page.waitForTimeout(3500);
    const w = await f.ev(() => {
      const host = document.querySelector('#w225host') || document.body;
      const a = [...host.querySelectorAll('a')].map(x => ({ t: x.textContent.trim(), h: x.getAttribute('href') || '', tg: x.getAttribute('target') }));
      const card = host.querySelector('.cl310');
      return { text: host.innerText, card: card ? card.innerText : '', a, errs: window.__errs || [] };
    });
    const top = w.a.find(x => x.t === 'Heat maps');
    check(label + ' top Heat maps button', !!top && /clarity\.microsoft\.com\/projects\/view\/zbcoohovt6\/heatmaps\?date=Last%2030%20days/.test(top.h) && top.tg === '_blank', top && top.h);
    const hm = w.a.filter(x => x.t === 'Heat map'), rec = w.a.filter(x => x.t === 'Recordings');
    check(label + ' per-page heat map links', hm.length >= 3 && rec.length >= 3, hm.length + '/' + rec.length);
    const gb = hm.find(x => decodeURIComponent(x.h).includes('gift-basket-drive'));
    check(label + ' page filter format', !!gb && decodeURIComponent(gb.h).includes('URL=2;6;^https://welfareavenue\\.com/gift-basket-drive/(\\?.*)?$'), gb && decodeURIComponent(gb.h).slice(-80));
    check(label + ' Clarity card', /Heat maps and recordings/i.test(w.card), w.card.slice(0, 60));
    if (connected) {
      check(label + ' Clarity stats', /Visits recorded\s*84/.test(w.card) && /Rage clicks\s*6/.test(w.card) && /Dead clicks\s*19/.test(w.card) && /47%/.test(w.card) && /41 s/.test(w.card), w.card.slice(0, 300).replace(/\n/g, ' | '));
      check(label + ' Clarity page table', /Holiday Gift Basket Drive/.test(w.card) && /people get stuck/.test(w.card));
      check(label + ' Clarity start note', /start 2026-11-12/.test(w.card));
    } else {
      check(label + ' not connected message', /Data export/.test(w.card) && /already work/.test(w.card));
    }
    check(label + ' Open heat maps button', /Open heat maps/i.test(w.card));
    check(label + ' GA cards still there', /how far people read/i.test(w.text) && /what people click/i.test(w.text));
    await page.screenshot({ path: `${OUT}/w310_${label}.png`, fullPage: true });
    try { await page.locator('.cl310').screenshot({ path: `${OUT}/w310_${label}_card.png` }); } catch (e) { console.log('card shot skipped: ' + e.message.slice(0, 80)); }
    await f.close();
  }
  await browser.close();
  const fails = results.filter(r => r.startsWith('FAIL'));
  console.log((results.length - fails.length) + '/' + results.length + ' pass');
  process.exit(fails.length ? 1 : 0);
})();
