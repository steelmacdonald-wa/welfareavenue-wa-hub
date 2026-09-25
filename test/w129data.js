/* w129data.js: a synthetic social_range() for the drive tests. Two years of daily numbers (Facebook, Instagram,
   the website), a year of LinkedIn from the export, and six years of posts, bucketed by day, week or month the way
   the wa129 RPC does it. Injected into the page as window.__SR(args). */
window.__SR = (function () {
  var DAY = 86400000, TODAY = '2026-09-25';
  function T(s) { return new Date(String(s).slice(0, 10) + 'T00:00:00Z').getTime(); }
  function iso(t) { return new Date(t).toISOString().slice(0, 10); }
  function rnd(seed) { var x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); }
  var PLAT = {
    instagram: { from: '2024-09-26', to: TODAY, m: { reach: 900, views: 2400, engagement: 60, new_followers: 3, profile_views: 40, accounts_engaged: 35 }, f0: 1180, grow: 0.6 },
    facebook: { from: '2024-09-25', to: TODAY, m: { reach: 500, views: 1400, engagement: 30, new_followers: 1, clicks: 12 }, f0: 2050, grow: 0.25 },
    linkedin: { from: '2025-09-24', to: '2026-09-23', m: { views: 300, engagement: 12, new_followers: 2, clicks: 8 } },
    ga4: { from: '2024-09-25', to: '2026-09-24', m: { sessions: 60, users: 50, new_users: 38, pageviews: 140, sessions_social: 9 } }
  };
  function val(p, m, t) {
    var base = PLAT[p].m[m], i = Math.round((t - T('2024-01-01')) / DAY), wd = new Date(t).getUTCDay();
    return Math.max(0, Math.round(base * (1 + 0.35 * Math.sin(i / 58)) * (1 + (i - 300) / 1400) * (wd === 0 || wd === 6 ? 0.75 : 1.08) * (0.7 + 0.6 * rnd(i * 13 + m.length * 7 + p.length))));
  }
  function fol(p, t) { var P = PLAT[p]; if (!P.f0 || t < T(P.from)) return null; return Math.round(P.f0 + (t - T(P.from)) / DAY * P.grow); }
  /* six years of posts */
  var CAPS = ['Volunteer with us this Saturday at the food bank in Montreal', 'Rally Paper 2026: thank you to every team who ran the city', 'Thank you to our donors, your gifts filled 300 hampers',
    'Meet the Toronto operations team', 'Winter clothing drive: drop-off points and hours', 'Croissant sale this Sunday, all proceeds to the youth program',
    'Our volunteers packed 1,200 meals in one afternoon', 'Ramadan food baskets: how to help', 'Back to school: 400 backpacks for families in Laval',
    'A word from our co-founder on five years of Welfare Avenue', 'Sign up to volunteer: link in bio', 'Behind the scenes at the warehouse', ''];
  var POSTS = [];
  (function () {
    var id = 1;
    function add(p, kind, t, k) {
      var cap = CAPS[(k * 7 + p.length) % CAPS.length], big = kind === 'reels' || kind === 'video' ? 3 : 1, old = t < T('2024-09-25');
      var reach = Math.round((p === 'linkedin' ? 0 : 1) * (300 + 900 * rnd(k * 3 + 1)) * big * (old ? 0.6 : 1));
      var likes = Math.round(10 + 80 * rnd(k * 5 + 2) * big), comments = Math.round(6 * rnd(k * 7 + 3)), shares = Math.round(9 * rnd(k * 11 + 4)), saves = p === 'instagram' ? Math.round(12 * rnd(k * 13 + 5)) : null;
      var post = { id: id++, platform: p, external_id: p + '_' + k, url: 'https://example.org/' + p + '/' + k, kind: kind, caption: cap || null,
        thumb_url: p === 'linkedin' || (p === 'facebook' && k % 9 === 0) ? null : 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
        published_at: new Date(t + (9 + (k % 10)) * 3600000).toISOString(), reach: p === 'linkedin' ? null : (old && k % 11 === 0 ? null : reach),
        views: p === 'facebook' && k % 8 === 0 ? null : Math.round((p === 'linkedin' ? 250 + 600 * rnd(k) : reach * (1.6 + rnd(k * 17)))), likes: likes, comments: comments, shares: shares, saves: saves,
        clicks: p === 'instagram' ? null : Math.round(20 * rnd(k * 19 + 6)), engagement: likes + comments + shares + (saves || 0) };
      POSTS.push(post);
    }
    var k = 0;
    for (var t = T('2020-09-25'); t <= T('2026-09-17'); t += 6.6 * DAY) { k++; add('instagram', k % 5 === 0 ? 'reels' : 'feed', T(iso(t)), k); }
    for (var t2 = T('2020-10-01'); t2 <= T('2026-09-17'); t2 += 7.8 * DAY) { k++; add('facebook', 'post', T(iso(t2)), k); }
    for (var t3 = T('2025-10-09'); t3 <= T('2026-09-17'); t3 += 9.5 * DAY) { k++; add('linkedin', k % 12 === 0 ? 'video' : 'post', T(iso(t3)), k); }
  })();
  var ACCOUNTS = [
    { id: 3, platform: 'facebook', external_id: '101', name: 'Welfare Avenue', handle: null, status: 'connected', last_sync_at: '2026-09-25T10:05:00Z', last_error: null, meta: { history: { daily_done: true, posts_done: true, daily_from: '2024-09-25', started_at: '2026-09-25T02:12:00Z' } } },
    { id: 5, platform: 'ga4', external_id: '4455', name: 'Website', handle: null, status: 'connected', last_sync_at: '2026-09-25T10:05:00Z', last_error: null, meta: { site: 'welfareavenue.com', history: { daily_done: true, posts_done: true, started_at: '2026-09-25T02:11:00Z' } } },
    { id: 4, platform: 'instagram', external_id: '178', name: 'welfareavenue', handle: 'welfareavenue', status: 'connected', last_sync_at: '2026-09-25T10:05:00Z', last_error: null,
      meta: { media_count: 330, history: { daily_done: true, posts_done: true, totals_done: false, totals_from: '2025-06-01', started_at: '2026-09-25T02:11:00Z' },
        demographics: { as_of: '2026-09-25', source: 'Instagram API', followers: {
          age: [['25-34', 520], ['18-24', 210], ['35-44', 330], ['13-17', 1], ['45-54', 120], ['55-64', 40], ['65+', 15]],
          gender: [['Women', 646], ['Men', 510], ['Unknown', 40]],
          city: [['Montreal, Quebec', 729], ['Toronto, Ontario', 180], ['Laval, Quebec', 60], ['Longueuil, Quebec', 41], ['Ottawa, Ontario', 22], ['Brossard, Quebec', 18], ['Mississauga, Ontario', 15], ['Gatineau, Quebec', 11], ['Sherbrooke, Quebec', 6]],
          country: [['CA', 1195], ['US', 40], ['FR', 22], ['MA', 12], ['LB', 9], ['DZ', 7], ['TN', 5]] } } } },
    { id: 6, platform: 'linkedin', external_id: 'csv', name: 'welfareavenue', handle: 'welfareavenue', status: 'csv', last_sync_at: '2026-09-25T09:00:00Z', last_error: null,
      meta: { demographics: { as_of: '2026-09-23', source: 'LinkedIn export', period: ['2025-09-24', '2026-09-23'],
        followers: { industry: [['Non-profit Organizations', 48], ['Higher Education', 33], ['IT Services', 21], ['Hospitals and Health Care', 15], ['Government Administration', 12], ['Banking', 9], ['Retail', 7], ['Civic and Social Organizations', 6]],
          seniority: [['Entry', 319], ['Senior', 120], ['Manager', 60], ['Director', 22], ['Training', 18], ['VP', 6], ['Owner', 5], ['CXO', 4], ['Partner', 2]],
          job_function: [['Business Development', 72], ['Operations', 54], ['Community and Social Services', 41], ['Education', 33], ['Engineering', 21], ['Marketing', 18], ['Healthcare Services', 12]],
          location: [['Greater Montreal Metropolitan Area, Canada', 481], ['Greater Toronto Area, Canada', 120], ['Ottawa, Canada', 18], ['Quebec City, Canada', 9], ['Paris, France', 4]],
          company_size: [['10001+', 143], ['11-50', 90], ['2-10', 70], ['1001-5000', 60], ['51-200', 55], ['201-500', 40], ['501-1000', 30], ['5001-10000', 20], ['1', 8]] },
        visitors: { industry: [['Non-profit Organizations', 120], ['Higher Education', 80], ['IT Services', 41]], seniority: [['Entry', 602], ['Senior', 210]], job_function: [['Business Development', 154], ['Operations', 90]],
          location: [['Greater Montreal Metropolitan Area, Canada', 1272], ['Greater Toronto Area, Canada', 301]], company_size: [['11-50', 267], ['2-10', 180], ['10001+', 150]] } } } }
  ];
  function bkey(bucket, t) { if (bucket === 'day') return iso(t); var d = new Date(t); if (bucket === 'week') return iso(t - ((d.getUTCDay() + 6) % 7) * DAY); return iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); }
  function eng(p) { return (p.engagement || 0) + (p.views || 0) / 20 + (p.reach || 0) / 20; }
  function fn(args) {
    args = args || {};
    var to = args.p_to || TODAY, minPost = POSTS.reduce(function (m, p) { var d = p.published_at.slice(0, 10); return !m || d < m ? d : m; }, null);
    var from = args.p_from || (minPost < '2024-09-25' ? minPost : '2024-09-25'); if (from > to) from = to;
    var days = Math.round((T(to) - T(from)) / DAY) + 1, bucket = days <= 120 ? 'day' : days <= 540 ? 'week' : 'month';
    var prevTo = iso(T(from) - DAY), prevFrom = iso(T(from) - days * DAY);
    var totals = {}, series = {}, followers = {}, coverage = {};
    Object.keys(PLAT).forEach(function (p) {
      var P = PLAT[p], tt = {}, ss = {};
      var a = Math.max(T(prevFrom), T(P.from)), b = Math.min(T(to), T(P.to));
      for (var t = a; t <= b; t += DAY) {
        var inCur = t >= T(from);
        Object.keys(P.m).forEach(function (m) {
          var v = val(p, m, t); tt[m] = tt[m] || { cur: null, prev: null };
          if (inCur) { tt[m].cur = (tt[m].cur || 0) + v; var k = bkey(bucket, t); ss[m] = ss[m] || {}; ss[m][k] = (ss[m][k] || 0) + v; }
          else tt[m].prev = (tt[m].prev || 0) + v;
        });
        if (inCur && P.f0) { var k2 = bkey(bucket, t); ss.followers = ss.followers || {}; ss.followers[k2] = fol(p, t); }
      }
      var pd = Math.max(0, Math.round((Math.min(T(prevTo), T(P.to)) - Math.max(T(prevFrom), T(P.from))) / DAY) + 1);
      if (pd < Math.max(1, Math.floor(days * 0.9))) Object.keys(tt).forEach(function (m) { tt[m].prev = null; });
      totals[p] = tt; series[p] = {};
      Object.keys(ss).forEach(function (m) { series[p][m] = Object.keys(ss[m]).sort().map(function (k) { return [k, ss[m][k]]; }); });
      if (P.f0) { var nowT = Math.min(T(to), T(P.to)); followers[p] = { now: fol(p, nowT), day: iso(nowT), then: fol(p, T(from)) }; }
      var np = POSTS.filter(function (x) { return x.platform === p; });
      coverage[p] = { from: P.from, to: P.to, days: Math.round((T(P.to) - T(P.from)) / DAY) + 1, posts: p === 'ga4' ? 25 : np.length, posts_from: p === 'ga4' ? '2026-09-24T12:00:00+00:00' : (np[0] ? np[0].published_at : null) };
    });
    var inR = POSTS.filter(function (x) { var d = x.published_at.slice(0, 10); return d >= from && d <= to; });
    var top = inR.slice().sort(function (a, b) { return eng(b) - eng(a); }).slice(0, 24);
    var all = inR.slice().sort(function (a, b) { return a.published_at < b.published_at ? 1 : -1; }).map(function (x) { var y = Object.assign({}, x); y.caption = x.caption ? x.caption.slice(0, 280) : null; return y; });
    var pages = [['/', 'Home', 4200], ['/volunteer', 'Volunteer', 1800], ['/donate', 'Donate', 1300], ['/about', 'About us', 700]].map(function (x, i) { return { id: 9000 + i, platform: 'ga4', external_id: x[0], url: 'https://welfareavenue.com' + x[0], kind: 'page', caption: x[1], published_at: '2026-09-24T12:00:00+00:00', reach: Math.round(x[2] / 3), views: x[2] }; });
    return JSON.parse(JSON.stringify({ days: days, from: from, to: to, prev_from: prevFrom, prev_to: prevTo, bucket: bucket, accounts: window.__SR_ACCOUNTS || ACCOUNTS, totals: totals, followers: followers, series: series,
      posts: top, posts_all: all, pages: pages, coverage: coverage, note: null, insights: { id: 1, week_start: '2026-09-21', body: 'Reels travel furthest.', data: { recommendations: [] }, model: 'test', created_at: '2026-09-24T12:00:00Z' } }));
  }
  fn.accounts = ACCOUNTS; fn.posts = POSTS;
  return fn;
})();
