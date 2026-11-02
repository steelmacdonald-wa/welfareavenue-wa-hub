-- wave261 (16/10/26, rebased 17/10/26 on the drive page's gift ladder): the website's part, md5-guarded: each www_files row is replaced
-- only if it still holds the expected live file; then www-sync deploys welfareavenue.com. Run AFTER migration wa261_drive_forms (the forms
-- must exist). Source: build/www/live (the live files, gbd_gift_ladder.py, then patch 261_drive_popups.py; the two commute).
do $deploy$
declare n int := 0; v text;
begin
  if (select md5(content) from public.www_files where path = 'gift-basket-drive/index.html' and part = 0) <> '19336e80daf1cd7afb9bdd3d07af0c1f' then raise exception 'www_files gift-basket-drive/index.html moved since 17/10/26 (expected 19336e80): rebase first'; end if;
  v := $w261f$<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Holiday Gift Basket Drive · Welfare Avenue</title>
<meta name="description" content="Every December, Welfare Avenue volunteers fill, wrap and hand-deliver holiday gifts across Montreal. This year we are aiming for 6,000 gifts: give, donate essentials or wrap with us.">
<link rel="canonical" href="https://welfareavenue.com/gift-basket-drive/">
<link rel="alternate" hreflang="en" href="https://welfareavenue.com/gift-basket-drive/">
<link rel="alternate" hreflang="fr" href="https://welfareavenue.com/fr/paniers-cadeaux/">
<link rel="alternate" hreflang="x-default" href="https://welfareavenue.com/gift-basket-drive/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Welfare Avenue">
<meta property="og:title" content="Holiday Gift Basket Drive · Welfare Avenue">
<meta property="og:description" content="Every December, Welfare Avenue volunteers fill, wrap and hand-deliver holiday gifts across Montreal. This year we are aiming for 6,000 gifts: give, donate essentials or wrap with us.">
<meta property="og:url" content="https://welfareavenue.com/gift-basket-drive/">
<meta property="og:image" content="https://welfareavenue.com/img/2025-12-gift-baskets-the-crew-1600.jpg">
<meta property="og:image:width" content="1600">
<meta property="og:image:height" content="1200">
<meta property="og:locale" content="en_CA">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#103F39">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&amp;family=Space+Grotesk:wght@400;500;700&amp;display=swap">
<link rel="stylesheet" href="/assets/site.css?v=dc9f2dab">
<link rel="stylesheet" href="/assets/drive.css?v=b02224f2">
<script src="/assets/site.js?v=e0110ae5" defer></script>
<script src="/assets/forms.js?v=545cd9b5" defer></script>
<script src="/assets/drive.js?v=1de7b1df" defer></script>
<script src="/assets/signin.js?v=1a2141be" defer></script>
<script src="https://hub.welfareavenue.com/give/embed.js" async></script>
</head>
<body data-lang="en" data-supa="https://zwnmulmnvopclzcvytce.supabase.co" data-key="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3bm11bG1udm9wY2x6Y3Z5dGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NjQxMjUsImV4cCI6MjA5ODM0MDEyNX0.YVeW1e8ffqkp3nOWdEyYXx4Kq-Tms61uReqDgypt3A4">
<a class="skip" href="#main">Skip to content</a>
<div class="langhint" id="langhint" hidden lang="fr"><div class="wrap"><span>Ce site est aussi offert en français.</span> <a href="/fr/paniers-cadeaux/" hreflang="fr">Voir la version française</a><button type="button" aria-label="Fermer">&times;</button></div></div>
<header class="top"><div class="wrap">
<a class="brand" href="/" aria-label="Welfare Avenue, home"><img src="/assets/logo-green.svg" alt="Welfare Avenue" width="130" height="44"></a>
<a class="btn donate-m" href="https://hub.welfareavenue.com/give" data-wa-donate>Donate</a>
<button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav"><span aria-hidden="true"></span><b class="sr">Menu</b></button>
<nav class="nav" id="nav" aria-label="Main"><div class="links"><a href="/">Home</a><div class="dd"><a class="dd-top" href="/volunteer/">Volunteer</a><button type="button" class="dd-btn" aria-expanded="false" aria-controls="dd-vol"><span class="sr">More ways to volunteer</span><svg class="dd-ch" viewBox="0 0 12 8" aria-hidden="true" focusable="false"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></button><div class="dd-menu" id="dd-vol"><a href="/volunteer/#montreal"><svg class="dd-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M12 21s-6.5-5.8-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/></g></svg><span><b>Volunteer in Montreal</b><small>Sunday servings downtown</small></span></a><a href="/toronto/"><svg class="dd-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M12 21s-6.5-5.8-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/></g></svg><span><b>Volunteer in Toronto</b><small>Monthly community cooking</small></span></a><a href="/volunteer/#groups"><svg class="dd-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><circle cx="9" cy="8" r="3"/><path d="M3.5 19.5c0-3.4 2.4-5.5 5.5-5.5s5.5 2.1 5.5 5.5"/><path d="M15.5 5.3a2.8 2.8 0 0 1 0 5.4M17.5 14.3c1.9.6 3 2.4 3 5.2"/></g></svg><span><b>Collaborate with us</b><small>Schools, clubs and companies</small></span></a><a href="/join/"><svg class="dd-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></g></svg><span><b>Join our team</b><small>Open roles, a few hours a week</small></span></a></div></div><a href="/events/">Our activities</a><a href="/press/">Press</a><a href="/about/">About us</a><a class="lang" href="/fr/paniers-cadeaux/" hreflang="fr" lang="fr">Français</a></div><div class="side"><a href="/account/" data-acct-link hidden>My account<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a><a href="/contact/">Contact<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a><a href="/volunteer/#apply" data-signup>Sign up<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></div></nav>
</div></header>
<main id="main">
<section class="hero page"><div class="bg"><img src="/img/2025-12-gift-baskets-the-crew-960.jpg" srcset="/img/2025-12-gift-baskets-the-crew-480.jpg 480w, /img/2025-12-gift-baskets-the-crew-960.jpg 960w, /img/2025-12-gift-baskets-the-crew-1600.jpg 1600w" sizes="100vw" width="1600" height="1200" alt="About twenty volunteers hold up wrapped gifts behind tables in a bright room with city windows." fetchpriority="high"></div><div class="wrap"><p class="over">December 2026 · Montreal</p><h1>Holiday Gift Basket Drive</h1><p class="lede">Every December, our volunteers fill, wrap and hand-deliver holiday gifts across Montreal. This year, for our third drive, we’re aiming for 6,000 gifts. Come be part of it.</p><div class="btns"><a class="btn" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive" data-wa-donate data-wa-campaign="gift-basket-drive">Give to the drive<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a><a class="btn ghost" href="#ways">Ways to get involved<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></div></div></section>
<section class="band on-white" id="progress"><div class="wrap drp"><div class="drp-goal"><p class="over">Our goal this year</p><p class="drp-big">6,000</p><p>gifts, wrapped and hand-delivered across Montreal</p><p class="fine">Last year: more than 3,000 gifts. The year before: more than 1,500.</p><div class="drp-gifts" data-dr-gifts="gift-basket-drive" hidden><p class="drp-gn"><b data-dr="gifts-n">0</b><span>gifts collected so far</span></p><div class="drp-bar" data-dr="gifts-bar" role="progressbar" aria-label="Gifts collected toward our goal" aria-valuemin="0" aria-valuemax="6000" aria-valuenow="0" hidden><span data-dr="gifts-fill"></span></div><p class="fine" data-dr="gifts-way" hidden></p></div></div><div class="drp-card" data-campaign="gift-basket-drive" aria-live="polite"><p class="over">So far this year</p><p class="drp-raised"><b data-dr="raised">$0</b><span>given to the drive</span></p><div class="drp-bar" data-dr="bar" role="progressbar" aria-label="Toward our goal" aria-valuemin="0" aria-valuemax="100" hidden><span data-dr="fill"></span></div><a class="btn" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive" data-wa-donate data-wa-campaign="gift-basket-drive">Give to the drive<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></div></div></section>
<section class="band on-grey" id="about"><div class="wrap split"><div><p class="over">What the drive is</p><h2>A holiday tradition, three years in</h2><p>The Holiday Gift Basket Drive is our biggest moment of the year. Donations come in through November, then our volunteers gather in December to wrap everything and hand-deliver it before the holidays.</p><p>Cozy socks, warm hats, toys and care packages go to guests at Montreal shelters and to young patients in hospital, a small reminder that someone was thinking of them.</p><p>Since 2024, we’ve run the drive with our partners at Scattered: more than 1,500 gifts that first year, then more than 3,000 last year.</p></div><div class="pic"><img src="/img/2025-12-gift-baskets-delivery-960.jpg" srcset="/img/2025-12-gift-baskets-delivery-480.jpg 480w, /img/2025-12-gift-baskets-delivery-960.jpg 960w, /img/2025-12-gift-baskets-delivery-1600.jpg 1600w" sizes="(min-width: 900px) 50vw, 100vw" width="1600" height="1204" alt="Five volunteers stand with carts piled high with gift bags in a lobby." loading="lazy" decoding="async"></div></div></section>
<section class="band on-white drw" id="ways"><div class="wrap"><div class="ihead"><h2>Three ways to get involved</h2></div><ul class="ways"><li class="way" id="give-items"><p class="way-k"><svg class="dd-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><rect x="3.5" y="8.5" width="17" height="4"/><path d="M5 12.5v8h14v-8M12 8.5v12"/><path d="M12 8.5C10.5 5 6.5 4.3 6.5 6.9c0 1.6 3 1.6 5.5 1.6zM12 8.5c1.5-3.5 5.5-4.2 5.5-1.6 0 1.6-3 1.6-5.5 1.6z"/></g></svg><span>In kind</span></p><h3>Donate gifts and essentials</h3><p>Clothing can be gently used. Hygiene essentials and toys must be brand new, so every gift feels like a gift.</p><p class="fine">We’re collecting donations from mid-November to the end of November.</p><div data-wa-form="gift-drive-give" data-wa-popup="Tell us what you’re giving" data-wa-popup-id="give-items" data-wa-popup-bare="textlink" data-wa-popup-title="Donate gifts and essentials"><a class="textlink" href="mailto:info@welfareavenue.com?subject=Holiday%20Gift%20Basket%20Drive%3A%20donating%20items">Write to us to give items<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></div></li><li class="way"><p class="way-k"><svg class="dd-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.4 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/></g></svg><span>Online</span></p><h3>Make a donation</h3><p>Your gift goes straight to the Holiday Gift Basket Drive. It takes a minute, without leaving this page.</p><p class="fine">Secure payment through Stripe.</p><a class="textlink" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive" data-wa-donate data-wa-campaign="gift-basket-drive">Give to the drive<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></li><li class="way" id="wrap-with-us"><p class="way-k"><svg class="dd-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="6.5" cy="6.5" r="2.5"/><path d="M8.6 8 20 18M8.6 16 20 6"/></g></svg><span>Volunteer</span></p><h3>Wrap with us</h3><p>Join our gift-wrapping event in December: good music, good company and a lot of tape.</p><p class="fine">Dates are coming soon.</p><div data-wa-form="gift-drive-volunteer" data-wa-popup="Sign up to help" data-wa-popup-id="wrap-with-us" data-wa-popup-bare="textlink" data-wa-popup-title="Volunteer with the drive"><a class="textlink" href="/volunteer/">Volunteer with us<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></div></li></ul></div></section>
<section class="band on-cream gl" id="gift-ladder"><div class="wrap"><div class="gl-head"><img class="gl-heart" src="/assets/doodle-heart-gold.png" alt="" width="88" height="97" loading="lazy" decoding="async"><h2>What your gift provides</h2><p class="lede">Gifts to the drive become warm clothes, hygiene kits, books and toys, wrapped by our volunteers and hand-delivered across Montreal this December.</p></div><ul class="gtags" aria-label="What each amount provides"><li class="gt"><svg class="gt-str" viewBox="0 0 40 64" aria-hidden="true" focusable="false"><path d="M20 60C20.5 47 9 41 8.5 28C8 14 25 7 31 16.5C36.5 25 25 33 19.5 25.5C15 19 21.5 6.5 34 2"/></svg><p class="gt-amt">$25</p><h3 class="gt-t" id="gt25-t">Warm feet for five</h3><p class="gt-d" id="gt25-d">Five pairs of warm winter socks for guests at Montreal shelters.</p><a class="gt-go" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive&amp;a=25" data-wa-donate data-wa-campaign="gift-basket-drive" data-wa-amount="25" aria-describedby="gt25-t gt25-d"><span>Give <span class="gt-gm">$25</span></span><svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></li><li class="gt"><svg class="gt-str" viewBox="0 0 40 64" aria-hidden="true" focusable="false"><path d="M20 60C20.5 47 9 41 8.5 28C8 14 25 7 31 16.5C36.5 25 25 33 19.5 25.5C15 19 21.5 6.5 34 2"/></svg><p class="gt-amt">$50</p><h3 class="gt-t" id="gt50-t">One full holiday basket</h3><p class="gt-d" id="gt50-d">Socks, a toque, gloves and a hygiene kit for one shelter guest, wrapped and hand-delivered.</p><a class="gt-go" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive&amp;a=50" data-wa-donate data-wa-campaign="gift-basket-drive" data-wa-amount="50" aria-describedby="gt50-t gt50-d"><span>Give <span class="gt-gm">$50</span></span><svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></li><li class="gt"><svg class="gt-str" viewBox="0 0 40 64" aria-hidden="true" focusable="false"><path d="M20 60C20.5 47 9 41 8.5 28C8 14 25 7 31 16.5C36.5 25 25 33 19.5 25.5C15 19 21.5 6.5 34 2"/></svg><p class="gt-amt">$100</p><h3 class="gt-t" id="gt100-t">Gifts for eight young patients</h3><p class="gt-d" id="gt100-d">A new book or a small toy for eight children in hospital this December.</p><a class="gt-go" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive&amp;a=100" data-wa-donate data-wa-campaign="gift-basket-drive" data-wa-amount="100" aria-describedby="gt100-t gt100-d"><span>Give <span class="gt-gm">$100</span></span><svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></li><li class="gt"><svg class="gt-str" viewBox="0 0 40 64" aria-hidden="true" focusable="false"><path d="M20 60C20.5 47 9 41 8.5 28C8 14 25 7 31 16.5C36.5 25 25 33 19.5 25.5C15 19 21.5 6.5 34 2"/></svg><p class="gt-amt">$250</p><h3 class="gt-t" id="gt250-t">Hygiene kits for twenty</h3><p class="gt-d" id="gt250-d">Toothbrush, toothpaste, soap, deodorant and shampoo for twenty people. Last year, it was what we had the least of.</p><a class="gt-go" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive&amp;a=250" data-wa-donate data-wa-campaign="gift-basket-drive" data-wa-amount="250" aria-describedby="gt250-t gt250-d"><span>Give <span class="gt-gm">$250</span></span><svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></li><li class="gt"><svg class="gt-str" viewBox="0 0 40 64" aria-hidden="true" focusable="false"><path d="M20 60C20.5 47 9 41 8.5 28C8 14 25 7 31 16.5C36.5 25 25 33 19.5 25.5C15 19 21.5 6.5 34 2"/></svg><p class="gt-amt">$500</p><h3 class="gt-t" id="gt500-t">Ten full holiday baskets</h3><p class="gt-d" id="gt500-d">Warm clothes and a hygiene kit for ten shelter guests, each basket wrapped and hand-delivered.</p><a class="gt-go" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive&amp;a=500" data-wa-donate data-wa-campaign="gift-basket-drive" data-wa-amount="500" aria-describedby="gt500-t gt500-d"><span>Give <span class="gt-gm">$500</span></span><svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></li><li class="gt gt-top"><svg class="gt-str" viewBox="0 0 40 64" aria-hidden="true" focusable="false"><path d="M20 60C20.5 47 9 41 8.5 28C8 14 25 7 31 16.5C36.5 25 25 33 19.5 25.5C15 19 21.5 6.5 34 2"/></svg><img class="gt-star" src="/assets/doodle-star-gold.png" alt="" width="72" height="77" loading="lazy" decoding="async"><p class="gt-amt">$1,000</p><h3 class="gt-t" id="gt1000-t">A whole shelter’s hygiene kits</h3><p class="gt-d" id="gt1000-d">Eighty kits: one for every guest at a shelter where we brought 80 baskets last year.</p><a class="gt-go" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive&amp;a=1000" data-wa-donate data-wa-campaign="gift-basket-drive" data-wa-amount="1000" aria-describedby="gt1000-t gt1000-d"><span>Give <span class="gt-gm">$1,000</span></span><svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></li></ul><div class="gl-foot"><a class="textlink" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive" data-wa-donate data-wa-campaign="gift-basket-drive">Or give the amount you choose<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a><p class="fine">Estimates from typical Canadian store prices for new items in 2026: about $5 for a pair of warm socks, $12 for a hygiene kit or for a child’s book or toy, and $40 to $50 for a full basket. Last year our volunteers packed 446 baskets for six Montreal shelters, from 46 to 100 each, and more for young patients in hospital. Every gift made on this page goes to the Holiday Gift Basket Drive.</p></div></div></section>
<section class="band on-grey" id="timeline"><div class="wrap"><h2>How the season runs</h2><ol class="drt mt2"><li><h3>Mid to end of November</h3><p>Donations of gifts, essentials and funds come in.</p></li><li><h3>December</h3><p>Our gift-wrapping event, over one or two weekends. Dates are coming soon.</p></li><li><h3>Before the holidays</h3><p>Volunteers hand-deliver the gifts across Montreal.</p></li></ol></div></section>
<section class="band on-white" id="sponsors"><div class="wrap cards2"><div class="card" id="sponsor"><h2>Companies and sponsors</h2><p>Businesses help by donating products or wrapping supplies, or by bringing their team to wrap with us. Write to us and we’ll send you our sponsorship package.</p><div class="btns"><div data-wa-form="gift-drive-sponsor" data-wa-popup="Tell us how you’d like to help" data-wa-popup-id="sponsor" data-wa-popup-bare="btn ghost" data-wa-popup-title="Companies and sponsors"><a class="btn ghost" href="mailto:info@welfareavenue.com?subject=Holiday%20Gift%20Basket%20Drive%3A%20sponsorship">Write to us<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></div></div></div><div class="card" id="groups-drive"><h2>Schools and groups</h2><p>Bring your class, club or team to help collect donations or wrap gifts. Tell us about your group and we’ll find the right fit.</p><div class="btns"><div data-wa-form="gift-drive-group" data-wa-popup="Bring your group" data-wa-popup-id="groups-drive" data-wa-popup-bare="btn ghost" data-wa-popup-title="Schools and groups"><a class="btn ghost" href="/volunteer/#groups">Bring your group<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></div></div></div></div></section>
<section class="band on-grey" id="photos"><div class="wrap"><h2>Last year’s drive</h2><p class="maxw mt1">December 2025, Montreal.</p><div class="gallery drg mt2" data-lb-group><button type="button" data-full="/img/2025-12-gift-baskets-the-crew-1600.jpg" data-title="The gift basket crew, December 2025" data-alt="About twenty volunteers hold up wrapped gifts behind tables in a bright room with city windows."><img src="/img/2025-12-gift-baskets-the-crew-960.jpg" srcset="/img/2025-12-gift-baskets-the-crew-480.jpg 480w, /img/2025-12-gift-baskets-the-crew-960.jpg 960w, /img/2025-12-gift-baskets-the-crew-1600.jpg 1600w" sizes="(min-width: 860px) 20vw, 50vw" width="1600" height="1200" alt="About twenty volunteers hold up wrapped gifts behind tables in a bright room with city windows." loading="lazy" decoding="async"></button><button type="button" data-full="/img/2025-12-gift-baskets-wrapping-960.jpg" data-title="Wrapping gifts, December 2025" data-alt="Volunteers sit on the floor wrapping gifts beside large windows and stacks of boxes."><img src="/img/2025-12-gift-baskets-wrapping-960.jpg" srcset="/img/2025-12-gift-baskets-wrapping-480.jpg 480w, /img/2025-12-gift-baskets-wrapping-960.jpg 960w" sizes="(min-width: 860px) 20vw, 50vw" width="960" height="1280" alt="Volunteers sit on the floor wrapping gifts beside large windows and stacks of boxes." loading="lazy" decoding="async"></button><button type="button" data-full="/img/2025-12-gift-baskets-bags-960.jpg" data-title="Gift bags ready to go, December 2025" data-alt="Brown paper gift bags filled with presents line a green table."><img src="/img/2025-12-gift-baskets-bags-960.jpg" srcset="/img/2025-12-gift-baskets-bags-480.jpg 480w, /img/2025-12-gift-baskets-bags-960.jpg 960w" sizes="(min-width: 860px) 20vw, 50vw" width="960" height="1707" alt="Brown paper gift bags filled with presents line a green table." loading="lazy" decoding="async"></button><button type="button" data-full="/img/2025-12-gift-baskets-elf-hat-960.jpg" data-title="A volunteer in an elf hat, December 2025" data-alt="A smiling volunteer in a green elf hat holds up a wrapped gift."><img src="/img/2025-12-gift-baskets-elf-hat-960.jpg" srcset="/img/2025-12-gift-baskets-elf-hat-480.jpg 480w, /img/2025-12-gift-baskets-elf-hat-960.jpg 960w" sizes="(min-width: 860px) 20vw, 50vw" width="960" height="1280" alt="A smiling volunteer in a green elf hat holds up a wrapped gift." loading="lazy" decoding="async"></button><button type="button" data-full="/img/2025-12-gift-baskets-delivery-1600.jpg" data-title="Gifts delivered, December 2025" data-alt="Five volunteers stand with carts piled high with gift bags in a lobby."><img src="/img/2025-12-gift-baskets-delivery-960.jpg" srcset="/img/2025-12-gift-baskets-delivery-480.jpg 480w, /img/2025-12-gift-baskets-delivery-960.jpg 960w, /img/2025-12-gift-baskets-delivery-1600.jpg 1600w" sizes="(min-width: 860px) 20vw, 50vw" width="1600" height="1204" alt="Five volunteers stand with carts piled high with gift bags in a lobby." loading="lazy" decoding="async"></button></div></div></section>
<section class="band on-green"><div class="wrap cta"><div><h2>Help us reach 6,000 gifts</h2><p class="lede mb0">Share this page with friends, family and your team. Every gift, big or small, ends up in someone’s hands this December.</p></div><div class="btns"><a class="btn" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive" data-wa-donate data-wa-campaign="gift-basket-drive">Give to the drive<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a><a class="btn ghost" href="#wrap-with-us">Volunteer with us<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></div></div></section>
</main>
<footer class="foot on-dark"><div class="wrap"><div class="cols">
<div class="who"><a class="logo" href="/" aria-label="Welfare Avenue, home"><img src="/assets/logo-cream.svg" alt="Welfare Avenue" width="120" height="40"></a><p><a href="mailto:info@welfareavenue.com">info@welfareavenue.com</a><br><a href="tel:+14388087754">(438) 808-7754</a></p><p>Montreal, Quebec<br>Toronto, Ontario</p></div>
<div><h2>Explore</h2><ul><li><a href="/">Home</a></li><li><a href="/events/">Our activities</a></li><li><a href="/volunteer/">Volunteer</a></li><li><a href="/toronto/">Toronto</a></li><li><a href="/volunteer/#groups">Volunteer as a group</a></li><li><a href="/press/">Press</a></li><li><a href="/about/">About us</a></li><li><a href="/donate/">Donate</a></li></ul></div>
<div><h2>About</h2><ul><li><a href="/about/#mission">Our mission</a></li><li><a href="/about/#story">Our story</a></li><li><a href="/about/#team">Our team</a></li><li><a href="/join/">Join our team</a></li><li><a href="/contact/#newsletter">Newsletter</a></li><li><a href="/contact/">Contact</a></li><li data-acct-link hidden><a href="/account/">My account</a></li></ul></div>
<div><h2>Connect</h2><div class="social"><a href="https://www.instagram.com/welfareavenue/" rel="noopener">Instagram</a><a href="https://www.tiktok.com/@welfareavenue" rel="noopener">TikTok</a><a href="https://www.linkedin.com/company/75487020/" rel="noopener">LinkedIn</a></div><p class="mt2"><a href="https://g.page/r/CVcrTC0okpYpEB0/review" rel="noopener">Leave us a Google review</a></p></div>
<div class="give"><p>Your generosity helps us</p><a class="btn light" href="https://hub.welfareavenue.com/give" data-wa-donate>Donate<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></div>
</div>
<div class="legal"><span>&copy; 2026 Welfare Avenue</span><span>Registered charity 713048502RR0001</span><span><a href="/privacy/">Privacy</a> &middot; <a href="/terms/">Terms</a> &middot; <a href="/data-deletion/">Data deletion</a></span></div>
</div></footer>
</body>
</html>
$w261f$;
  if md5(v) <> 'b71324ef58c944fb19183579aab8c6bc' then raise exception 'content check failed for gift-basket-drive/index.html'; end if;
  update public.www_files set content = v, md5 = md5(v), updated_at = now() where path = 'gift-basket-drive/index.html' and part = 0; n := n + 1;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('www_file', 'gift-basket-drive/index.html', 'content', '19336e80', 'b71324ef (wave261: the drive page''s pop-up forms and gift counter)', 'Claude (16/10 drive forms)');
  if (select md5(content) from public.www_files where path = 'fr/paniers-cadeaux/index.html' and part = 0) <> '87cfd50f7885e9d0d847cfc2e487ecc8' then raise exception 'www_files fr/paniers-cadeaux/index.html moved since 17/10/26 (expected 87cfd50f): rebase first'; end if;
  v := $w261f$<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Collecte de paniers-cadeaux des Fêtes · Welfare Avenue</title>
<meta name="description" content="Chaque décembre, les bénévoles de Welfare Avenue remplissent, emballent et livrent des cadeaux partout à Montréal. Cette année, nous visons 6 000 cadeaux : donnez, offrez des articles ou venez emballer avec nous.">
<link rel="canonical" href="https://welfareavenue.com/fr/paniers-cadeaux/">
<link rel="alternate" hreflang="en" href="https://welfareavenue.com/gift-basket-drive/">
<link rel="alternate" hreflang="fr" href="https://welfareavenue.com/fr/paniers-cadeaux/">
<link rel="alternate" hreflang="x-default" href="https://welfareavenue.com/gift-basket-drive/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Welfare Avenue">
<meta property="og:title" content="Collecte de paniers-cadeaux des Fêtes · Welfare Avenue">
<meta property="og:description" content="Chaque décembre, les bénévoles de Welfare Avenue remplissent, emballent et livrent des cadeaux partout à Montréal. Cette année, nous visons 6 000 cadeaux : donnez, offrez des articles ou venez emballer avec nous.">
<meta property="og:url" content="https://welfareavenue.com/fr/paniers-cadeaux/">
<meta property="og:image" content="https://welfareavenue.com/img/2025-12-gift-baskets-the-crew-1600.jpg">
<meta property="og:image:width" content="1600">
<meta property="og:image:height" content="1200">
<meta property="og:locale" content="fr_CA">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#103F39">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&amp;family=Space+Grotesk:wght@400;500;700&amp;display=swap">
<link rel="stylesheet" href="/assets/site.css?v=dc9f2dab">
<link rel="stylesheet" href="/assets/drive.css?v=b02224f2">
<script src="/assets/site.js?v=e0110ae5" defer></script>
<script src="/assets/forms.js?v=545cd9b5" defer></script>
<script src="/assets/drive.js?v=1de7b1df" defer></script>
<script src="/assets/signin.js?v=1a2141be" defer></script>
<script src="https://hub.welfareavenue.com/give/embed.js" async></script>
</head>
<body data-lang="fr" data-supa="https://zwnmulmnvopclzcvytce.supabase.co" data-key="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3bm11bG1udm9wY2x6Y3Z5dGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NjQxMjUsImV4cCI6MjA5ODM0MDEyNX0.YVeW1e8ffqkp3nOWdEyYXx4Kq-Tms61uReqDgypt3A4">
<a class="skip" href="#main">Aller au contenu</a>
<header class="top"><div class="wrap">
<a class="brand" href="/fr/" aria-label="Avenue du Bien-Être, accueil"><img src="/assets/logo-fr-green.png" alt="Avenue du Bien-Être" width="107" height="44"></a>
<a class="btn donate-m" href="https://hub.welfareavenue.com/give/?lang=fr" data-wa-donate>Faire un don</a>
<button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav"><span aria-hidden="true"></span><b class="sr">Menu</b></button>
<nav class="nav" id="nav" aria-label="Principal"><div class="links"><a href="/fr/">Accueil</a><div class="dd"><a class="dd-top" href="/fr/benevolat/">Bénévolat</a><button type="button" class="dd-btn" aria-expanded="false" aria-controls="dd-vol"><span class="sr">Autres façons de faire du bénévolat</span><svg class="dd-ch" viewBox="0 0 12 8" aria-hidden="true" focusable="false"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></button><div class="dd-menu" id="dd-vol"><a href="/fr/benevolat/#montreal"><svg class="dd-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M12 21s-6.5-5.8-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/></g></svg><span><b>Bénévolat à Montréal</b><small>Repas du dimanche au centre-ville</small></span></a><a href="/fr/toronto/"><svg class="dd-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M12 21s-6.5-5.8-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/></g></svg><span><b>Bénévolat à Toronto</b><small>Cuisine communautaire mensuelle</small></span></a><a href="/fr/benevolat/#groups"><svg class="dd-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><circle cx="9" cy="8" r="3"/><path d="M3.5 19.5c0-3.4 2.4-5.5 5.5-5.5s5.5 2.1 5.5 5.5"/><path d="M15.5 5.3a2.8 2.8 0 0 1 0 5.4M17.5 14.3c1.9.6 3 2.4 3 5.2"/></g></svg><span><b>Collaborer avec nous</b><small>Écoles, clubs et entreprises</small></span></a><a href="/fr/rejoindre/"><svg class="dd-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></g></svg><span><b>Rejoindre l’équipe</b><small>Postes ouverts, quelques heures par semaine</small></span></a></div></div><a href="/fr/evenements/">Nos activités</a><a href="/fr/presse/">Presse</a><a href="/fr/a-propos/">À propos</a><a class="lang" href="/gift-basket-drive/" hreflang="en" lang="en">English</a></div><div class="side"><a href="/fr/compte/" data-acct-link hidden>Mon compte<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a><a href="/fr/contact/">Contact<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a><a href="/fr/benevolat/#apply" data-signup>S’inscrire<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></div></nav>
</div></header>
<main id="main">
<section class="hero page"><div class="bg"><img src="/img/2025-12-gift-baskets-the-crew-960.jpg" srcset="/img/2025-12-gift-baskets-the-crew-480.jpg 480w, /img/2025-12-gift-baskets-the-crew-960.jpg 960w, /img/2025-12-gift-baskets-the-crew-1600.jpg 1600w" sizes="100vw" width="1600" height="1200" alt="Une vingtaine de bénévoles brandissent des cadeaux emballés derrière des tables, dans une salle lumineuse aux grandes fenêtres." fetchpriority="high"></div><div class="wrap"><p class="over">Décembre 2026 · Montréal</p><h1>Collecte de paniers-cadeaux des Fêtes</h1><p class="lede">Chaque décembre, nos bénévoles remplissent, emballent et livrent des cadeaux partout à Montréal. Pour cette troisième édition, nous visons 6&nbsp;000 cadeaux. Joignez-vous à nous!</p><div class="btns"><a class="btn" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive&amp;lang=fr" data-wa-donate data-wa-campaign="gift-basket-drive">Donner à la collecte<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a><a class="btn ghost" href="#ways">Comment participer<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></div></div></section>
<section class="band on-white" id="progress"><div class="wrap drp"><div class="drp-goal"><p class="over">Notre objectif cette année</p><p class="drp-big">6&nbsp;000</p><p>cadeaux emballés et livrés partout à Montréal</p><p class="fine">L’an dernier&nbsp;: plus de 3&nbsp;000 cadeaux. L’année d’avant&nbsp;: plus de 1&nbsp;500.</p><div class="drp-gifts" data-dr-gifts="gift-basket-drive" hidden><p class="drp-gn"><b data-dr="gifts-n">0</b><span>cadeaux recueillis jusqu’ici</span></p><div class="drp-bar" data-dr="gifts-bar" role="progressbar" aria-label="Cadeaux recueillis vers notre objectif" aria-valuemin="0" aria-valuemax="6000" aria-valuenow="0" hidden><span data-dr="gifts-fill"></span></div><p class="fine" data-dr="gifts-way" hidden></p></div></div><div class="drp-card" data-campaign="gift-basket-drive" aria-live="polite"><p class="over">Jusqu’ici cette année</p><p class="drp-raised"><b data-dr="raised">0&nbsp;$</b><span>donnés à la collecte</span></p><div class="drp-bar" data-dr="bar" role="progressbar" aria-label="Vers notre objectif" aria-valuemin="0" aria-valuemax="100" hidden><span data-dr="fill"></span></div><a class="btn" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive&amp;lang=fr" data-wa-donate data-wa-campaign="gift-basket-drive">Donner à la collecte<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></div></div></section>
<section class="band on-grey" id="about"><div class="wrap split"><div><p class="over">La collecte en bref</p><h2>Une tradition des Fêtes, déjà trois ans</h2><p>La collecte de paniers-cadeaux des Fêtes, c’est notre plus grand moment de l’année. Les dons arrivent en novembre, puis nos bénévoles se réunissent en décembre pour tout emballer et livrer les cadeaux avant les Fêtes.</p><p>Bas douillets, tuques chaudes, jouets et trousses de soins vont aux personnes accueillies dans les refuges de Montréal et à de jeunes patients à l’hôpital, un petit rappel que quelqu’un a pensé à eux.</p><p>Depuis 2024, nous organisons la collecte avec nos partenaires de Scattered&nbsp;: plus de 1&nbsp;500 cadeaux la première année, puis plus de 3&nbsp;000 l’an dernier.</p></div><div class="pic"><img src="/img/2025-12-gift-baskets-delivery-960.jpg" srcset="/img/2025-12-gift-baskets-delivery-480.jpg 480w, /img/2025-12-gift-baskets-delivery-960.jpg 960w, /img/2025-12-gift-baskets-delivery-1600.jpg 1600w" sizes="(min-width: 900px) 50vw, 100vw" width="1600" height="1204" alt="Cinq bénévoles posent dans un hall avec des chariots remplis de sacs-cadeaux." loading="lazy" decoding="async"></div></div></section>
<section class="band on-white drw" id="ways"><div class="wrap"><div class="ihead"><h2>Trois façons de participer</h2></div><ul class="ways"><li class="way" id="give-items"><p class="way-k"><svg class="dd-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><rect x="3.5" y="8.5" width="17" height="4"/><path d="M5 12.5v8h14v-8M12 8.5v12"/><path d="M12 8.5C10.5 5 6.5 4.3 6.5 6.9c0 1.6 3 1.6 5.5 1.6zM12 8.5c1.5-3.5 5.5-4.2 5.5-1.6 0 1.6-3 1.6-5.5 1.6z"/></g></svg><span>En nature</span></p><h3>Donner des cadeaux et des articles</h3><p>Les vêtements peuvent être usagés, en bon état. Les articles d’hygiène et les jouets doivent être neufs, pour que chaque cadeau en soit vraiment un.</p><p class="fine">Nous recueillons les dons de la mi-novembre à la fin novembre.</p><div data-wa-form="paniers-donner,gift-drive-give" data-wa-popup="Dites-nous ce que vous donnez" data-wa-popup-id="give-items" data-wa-popup-bare="textlink" data-wa-popup-title="Donner des cadeaux et des articles"><a class="textlink" href="mailto:info@welfareavenue.com?subject=Collecte%20de%20paniers-cadeaux%20%3A%20don%20d%E2%80%99articles">Écrivez-nous pour donner des articles<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></div></li><li class="way"><p class="way-k"><svg class="dd-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.4 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/></g></svg><span>En ligne</span></p><h3>Faire un don</h3><p>Votre don va directement à la collecte de paniers-cadeaux des Fêtes. Ça prend une minute, sans quitter cette page.</p><p class="fine">Paiement sécurisé par Stripe.</p><a class="textlink" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive&amp;lang=fr" data-wa-donate data-wa-campaign="gift-basket-drive">Donner à la collecte<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></li><li class="way" id="wrap-with-us"><p class="way-k"><svg class="dd-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="6.5" cy="6.5" r="2.5"/><path d="M8.6 8 20 18M8.6 16 20 6"/></g></svg><span>Bénévolat</span></p><h3>Emballer avec nous</h3><p>Joignez-vous à notre événement d’emballage de cadeaux en décembre&nbsp;: de la bonne musique, du bon monde et beaucoup de ruban adhésif.</p><p class="fine">Les dates seront annoncées bientôt.</p><div data-wa-form="paniers-benevole,gift-drive-volunteer" data-wa-popup="Je m’inscris pour aider" data-wa-popup-id="wrap-with-us" data-wa-popup-bare="textlink" data-wa-popup-title="Faire du bénévolat pour la collecte"><a class="textlink" href="/fr/benevolat/">Faire du bénévolat avec nous<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></div></li></ul></div></section>
<section class="band on-cream gl" id="gift-ladder"><div class="wrap"><div class="gl-head"><img class="gl-heart" src="/assets/doodle-heart-gold.png" alt="" width="88" height="97" loading="lazy" decoding="async"><h2>Ce que votre don permet d’offrir</h2><p class="lede">Les dons à la collecte deviennent des vêtements chauds, des trousses d’hygiène, des livres et des jouets, emballés par nos bénévoles et livrés en main propre partout à Montréal en décembre.</p></div><ul class="gtags" aria-label="Ce que chaque montant permet d’offrir"><li class="gt"><svg class="gt-str" viewBox="0 0 40 64" aria-hidden="true" focusable="false"><path d="M20 60C20.5 47 9 41 8.5 28C8 14 25 7 31 16.5C36.5 25 25 33 19.5 25.5C15 19 21.5 6.5 34 2"/></svg><p class="gt-amt">25&nbsp;$</p><h3 class="gt-t" id="gt25-t">Des pieds au chaud pour cinq</h3><p class="gt-d" id="gt25-d">Cinq paires de bas d’hiver bien chauds pour des personnes hébergées dans les refuges de Montréal.</p><a class="gt-go" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive&amp;a=25&amp;lang=fr" data-wa-donate data-wa-campaign="gift-basket-drive" data-wa-amount="25" aria-describedby="gt25-t gt25-d"><span>Donner <span class="gt-gm">25&nbsp;$</span></span><svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></li><li class="gt"><svg class="gt-str" viewBox="0 0 40 64" aria-hidden="true" focusable="false"><path d="M20 60C20.5 47 9 41 8.5 28C8 14 25 7 31 16.5C36.5 25 25 33 19.5 25.5C15 19 21.5 6.5 34 2"/></svg><p class="gt-amt">50&nbsp;$</p><h3 class="gt-t" id="gt50-t">Un panier des Fêtes complet</h3><p class="gt-d" id="gt50-d">Des bas, une tuque, des gants et une trousse d’hygiène pour une personne en refuge, emballés et livrés en main propre.</p><a class="gt-go" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive&amp;a=50&amp;lang=fr" data-wa-donate data-wa-campaign="gift-basket-drive" data-wa-amount="50" aria-describedby="gt50-t gt50-d"><span>Donner <span class="gt-gm">50&nbsp;$</span></span><svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></li><li class="gt"><svg class="gt-str" viewBox="0 0 40 64" aria-hidden="true" focusable="false"><path d="M20 60C20.5 47 9 41 8.5 28C8 14 25 7 31 16.5C36.5 25 25 33 19.5 25.5C15 19 21.5 6.5 34 2"/></svg><p class="gt-amt">100&nbsp;$</p><h3 class="gt-t" id="gt100-t">Des cadeaux pour huit jeunes patients</h3><p class="gt-d" id="gt100-d">Un livre neuf ou un petit jouet pour huit enfants hospitalisés en décembre.</p><a class="gt-go" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive&amp;a=100&amp;lang=fr" data-wa-donate data-wa-campaign="gift-basket-drive" data-wa-amount="100" aria-describedby="gt100-t gt100-d"><span>Donner <span class="gt-gm">100&nbsp;$</span></span><svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></li><li class="gt"><svg class="gt-str" viewBox="0 0 40 64" aria-hidden="true" focusable="false"><path d="M20 60C20.5 47 9 41 8.5 28C8 14 25 7 31 16.5C36.5 25 25 33 19.5 25.5C15 19 21.5 6.5 34 2"/></svg><p class="gt-amt">250&nbsp;$</p><h3 class="gt-t" id="gt250-t">Des trousses d’hygiène pour vingt</h3><p class="gt-d" id="gt250-d">Brosse à dents, dentifrice, savon, déodorant et shampoing pour vingt personnes. L’an dernier, c’est ce qui nous manquait le plus.</p><a class="gt-go" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive&amp;a=250&amp;lang=fr" data-wa-donate data-wa-campaign="gift-basket-drive" data-wa-amount="250" aria-describedby="gt250-t gt250-d"><span>Donner <span class="gt-gm">250&nbsp;$</span></span><svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></li><li class="gt"><svg class="gt-str" viewBox="0 0 40 64" aria-hidden="true" focusable="false"><path d="M20 60C20.5 47 9 41 8.5 28C8 14 25 7 31 16.5C36.5 25 25 33 19.5 25.5C15 19 21.5 6.5 34 2"/></svg><p class="gt-amt">500&nbsp;$</p><h3 class="gt-t" id="gt500-t">Dix paniers des Fêtes complets</h3><p class="gt-d" id="gt500-d">Des vêtements chauds et une trousse d’hygiène pour dix personnes en refuge, chaque panier emballé et livré en main propre.</p><a class="gt-go" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive&amp;a=500&amp;lang=fr" data-wa-donate data-wa-campaign="gift-basket-drive" data-wa-amount="500" aria-describedby="gt500-t gt500-d"><span>Donner <span class="gt-gm">500&nbsp;$</span></span><svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></li><li class="gt gt-top"><svg class="gt-str" viewBox="0 0 40 64" aria-hidden="true" focusable="false"><path d="M20 60C20.5 47 9 41 8.5 28C8 14 25 7 31 16.5C36.5 25 25 33 19.5 25.5C15 19 21.5 6.5 34 2"/></svg><img class="gt-star" src="/assets/doodle-star-gold.png" alt="" width="72" height="77" loading="lazy" decoding="async"><p class="gt-amt">1&nbsp;000&nbsp;$</p><h3 class="gt-t" id="gt1000-t">Les trousses d’hygiène de tout un refuge</h3><p class="gt-d" id="gt1000-d">Quatre-vingts trousses : une pour chaque personne d’un refuge où nous avons apporté 80 paniers l’an dernier.</p><a class="gt-go" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive&amp;a=1000&amp;lang=fr" data-wa-donate data-wa-campaign="gift-basket-drive" data-wa-amount="1000" aria-describedby="gt1000-t gt1000-d"><span>Donner <span class="gt-gm">1&nbsp;000&nbsp;$</span></span><svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></li></ul><div class="gl-foot"><a class="textlink" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive&amp;lang=fr" data-wa-donate data-wa-campaign="gift-basket-drive">Ou donnez le montant de votre choix<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a><p class="fine">Estimations selon les prix courants en magasin au Canada pour des articles neufs en 2026&nbsp;: environ 5&nbsp;$ pour une paire de bas chauds, 12&nbsp;$ pour une trousse d’hygiène ou pour un livre ou un jouet d’enfant, et de 40&nbsp;$ à 50&nbsp;$ pour un panier complet. L’an dernier, nos bénévoles ont préparé 446&nbsp;paniers pour six refuges de Montréal, de 46 à 100 chacun, et d’autres pour de jeunes patients à l’hôpital. Chaque don fait sur cette page va à la collecte de paniers-cadeaux des Fêtes.</p></div></div></section>
<section class="band on-grey" id="timeline"><div class="wrap"><h2>Le déroulement de la saison</h2><ol class="drt mt2"><li><h3>De la mi-novembre à la fin novembre</h3><p>Les dons de cadeaux, d’articles et d’argent arrivent.</p></li><li><h3>Décembre</h3><p>Notre événement d’emballage, sur une ou deux fins de semaine. Les dates seront annoncées bientôt.</p></li><li><h3>Avant les Fêtes</h3><p>Nos bénévoles livrent les cadeaux partout à Montréal.</p></li></ol></div></section>
<section class="band on-white" id="sponsors"><div class="wrap cards2"><div class="card" id="sponsor"><h2>Entreprises et commanditaires</h2><p>Les entreprises peuvent donner des produits ou du matériel d’emballage, ou venir emballer en équipe avec nous. Écrivez-nous et nous vous enverrons notre trousse de commandite.</p><div class="btns"><div data-wa-form="paniers-entreprises,gift-drive-sponsor" data-wa-popup="Dites-nous comment vous aimeriez aider" data-wa-popup-id="sponsor" data-wa-popup-bare="btn ghost" data-wa-popup-title="Entreprises et commanditaires"><a class="btn ghost" href="mailto:info@welfareavenue.com?subject=Collecte%20de%20paniers-cadeaux%20%3A%20commandite">Nous écrire<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></div></div></div><div class="card" id="groups-drive"><h2>Écoles et groupes</h2><p>Venez recueillir des dons ou emballer des cadeaux avec votre classe, votre club ou votre équipe. Parlez-nous de votre groupe et nous trouverons la bonne formule.</p><div class="btns"><div data-wa-form="paniers-groupes,gift-drive-group" data-wa-popup="Inscrire votre groupe" data-wa-popup-id="groups-drive" data-wa-popup-bare="btn ghost" data-wa-popup-title="Écoles et groupes"><a class="btn ghost" href="/fr/benevolat/#groups">Inscrire votre groupe<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></div></div></div></div></section>
<section class="band on-grey" id="photos"><div class="wrap"><h2>La collecte de l’an dernier</h2><p class="maxw mt1">Décembre 2025, Montréal.</p><div class="gallery drg mt2" data-lb-group><button type="button" data-full="/img/2025-12-gift-baskets-the-crew-1600.jpg" data-title="L’équipe de la collecte, décembre 2025" data-alt="Une vingtaine de bénévoles brandissent des cadeaux emballés derrière des tables, dans une salle lumineuse aux grandes fenêtres."><img src="/img/2025-12-gift-baskets-the-crew-960.jpg" srcset="/img/2025-12-gift-baskets-the-crew-480.jpg 480w, /img/2025-12-gift-baskets-the-crew-960.jpg 960w, /img/2025-12-gift-baskets-the-crew-1600.jpg 1600w" sizes="(min-width: 860px) 20vw, 50vw" width="1600" height="1200" alt="Une vingtaine de bénévoles brandissent des cadeaux emballés derrière des tables, dans une salle lumineuse aux grandes fenêtres." loading="lazy" decoding="async"></button><button type="button" data-full="/img/2025-12-gift-baskets-wrapping-960.jpg" data-title="L’emballage des cadeaux, décembre 2025" data-alt="Des bénévoles assis par terre emballent des cadeaux près de grandes fenêtres et de piles de boîtes."><img src="/img/2025-12-gift-baskets-wrapping-960.jpg" srcset="/img/2025-12-gift-baskets-wrapping-480.jpg 480w, /img/2025-12-gift-baskets-wrapping-960.jpg 960w" sizes="(min-width: 860px) 20vw, 50vw" width="960" height="1280" alt="Des bénévoles assis par terre emballent des cadeaux près de grandes fenêtres et de piles de boîtes." loading="lazy" decoding="async"></button><button type="button" data-full="/img/2025-12-gift-baskets-bags-960.jpg" data-title="Des sacs-cadeaux prêts à partir, décembre 2025" data-alt="Des sacs-cadeaux en papier brun remplis de présents s’alignent sur une table verte."><img src="/img/2025-12-gift-baskets-bags-960.jpg" srcset="/img/2025-12-gift-baskets-bags-480.jpg 480w, /img/2025-12-gift-baskets-bags-960.jpg 960w" sizes="(min-width: 860px) 20vw, 50vw" width="960" height="1707" alt="Des sacs-cadeaux en papier brun remplis de présents s’alignent sur une table verte." loading="lazy" decoding="async"></button><button type="button" data-full="/img/2025-12-gift-baskets-elf-hat-960.jpg" data-title="Une bénévole en bonnet de lutin, décembre 2025" data-alt="Une bénévole souriante coiffée d’un bonnet de lutin vert tient un cadeau emballé."><img src="/img/2025-12-gift-baskets-elf-hat-960.jpg" srcset="/img/2025-12-gift-baskets-elf-hat-480.jpg 480w, /img/2025-12-gift-baskets-elf-hat-960.jpg 960w" sizes="(min-width: 860px) 20vw, 50vw" width="960" height="1280" alt="Une bénévole souriante coiffée d’un bonnet de lutin vert tient un cadeau emballé." loading="lazy" decoding="async"></button><button type="button" data-full="/img/2025-12-gift-baskets-delivery-1600.jpg" data-title="Les cadeaux livrés, décembre 2025" data-alt="Cinq bénévoles posent dans un hall avec des chariots remplis de sacs-cadeaux."><img src="/img/2025-12-gift-baskets-delivery-960.jpg" srcset="/img/2025-12-gift-baskets-delivery-480.jpg 480w, /img/2025-12-gift-baskets-delivery-960.jpg 960w, /img/2025-12-gift-baskets-delivery-1600.jpg 1600w" sizes="(min-width: 860px) 20vw, 50vw" width="1600" height="1204" alt="Cinq bénévoles posent dans un hall avec des chariots remplis de sacs-cadeaux." loading="lazy" decoding="async"></button></div></div></section>
<section class="band on-green"><div class="wrap cta"><div><h2>Aidez-nous à atteindre 6&nbsp;000 cadeaux</h2><p class="lede mb0">Partagez cette page avec vos proches et votre équipe. Chaque don, petit ou grand, se retrouvera entre les mains de quelqu’un en décembre.</p></div><div class="btns"><a class="btn" href="https://hub.welfareavenue.com/give/?c=gift-basket-drive&amp;lang=fr" data-wa-donate data-wa-campaign="gift-basket-drive">Donner à la collecte<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a><a class="btn ghost" href="#wrap-with-us">Faire du bénévolat<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></div></div></section>
</main>
<footer class="foot on-dark"><div class="wrap"><div class="cols">
<div class="who"><a class="logo" href="/fr/" aria-label="Avenue du Bien-Être, accueil"><img src="/assets/logo-fr-cream.png" alt="Avenue du Bien-Être" width="120" height="49"></a><p><a href="mailto:info@welfareavenue.com">info@welfareavenue.com</a><br><a href="tel:+14388087754">438 808-7754</a></p><p>Montréal (Québec)<br>Toronto (Ontario)</p></div>
<div><h2>Explorer</h2><ul><li><a href="/fr/">Accueil</a></li><li><a href="/fr/evenements/">Nos activités</a></li><li><a href="/fr/benevolat/">Bénévolat</a></li><li><a href="/fr/toronto/">Toronto</a></li><li><a href="/fr/benevolat/#groups">Bénévolat en groupe</a></li><li><a href="/fr/presse/">Presse</a></li><li><a href="/fr/a-propos/">À propos</a></li><li><a href="/fr/donner/">Faire un don</a></li></ul></div>
<div><h2>À propos</h2><ul><li><a href="/fr/a-propos/#mission">Notre mission</a></li><li><a href="/fr/a-propos/#story">Notre histoire</a></li><li><a href="/fr/a-propos/#team">Notre équipe</a></li><li><a href="/fr/rejoindre/">Rejoindre l’équipe</a></li><li><a href="/fr/contact/#newsletter">Infolettre</a></li><li><a href="/fr/contact/">Contact</a></li><li data-acct-link hidden><a href="/fr/compte/">Mon compte</a></li></ul></div>
<div><h2>Nous suivre</h2><div class="social"><a href="https://www.instagram.com/welfareavenue/" rel="noopener">Instagram</a><a href="https://www.tiktok.com/@welfareavenue" rel="noopener">TikTok</a><a href="https://www.linkedin.com/company/75487020/" rel="noopener">LinkedIn</a></div><p class="mt2"><a href="https://g.page/r/CVcrTC0okpYpEB0/review" rel="noopener">Laissez-nous un avis Google</a></p></div>
<div class="give"><p>Votre générosité nous aide</p><a class="btn light" href="https://hub.welfareavenue.com/give/?lang=fr" data-wa-donate>Faire un don<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></a></div>
</div>
<div class="legal"><span>&copy; 2026 Welfare Avenue (Avenue du Bien-Être)</span><span>Organisme de bienfaisance enregistré 713048502RR0001</span><span><a href="/fr/confidentialite/">Confidentialité</a> &middot; <a href="/fr/conditions/">Conditions d’utilisation</a> &middot; <a href="/fr/suppression-des-donnees/">Suppression des données</a></span></div>
</div></footer>
</body>
</html>
$w261f$;
  if md5(v) <> 'fea3379a9d470e78b046b7e43b0ec4ca' then raise exception 'content check failed for fr/paniers-cadeaux/index.html'; end if;
  update public.www_files set content = v, md5 = md5(v), updated_at = now() where path = 'fr/paniers-cadeaux/index.html' and part = 0; n := n + 1;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('www_file', 'fr/paniers-cadeaux/index.html', 'content', '87cfd50f', 'fea3379a (wave261: the drive page''s pop-up forms and gift counter)', 'Claude (16/10 drive forms)');
  if (select md5(content) from public.www_files where path = 'assets/forms.js' and part = 0) <> '9c3e5d9785398db339b1c197b6caa652' then raise exception 'www_files assets/forms.js moved since 17/10/26 (expected 9c3e5d97): rebase first'; end if;
  v := $w261f$/* Welfare Avenue website (wave162, 28/09/26; wave216 07/10/26: a file question, the CV of an application form, uploaded on
   send through form-submit's one-time upload link): the Hub's forms inside the website's pages. Each
   <div data-wa-form="slug[,fallback]"> asks the Hub's form-submit function for the published form (drafts are not
   found, so the page keeps its own message until staff put the form live in the CRM), shows the questions in the
   form's language, and posts the answers back with the signed token, the hidden field and the timing checks that
   form-submit expects. Same protocol as the Hub's own page at hub.welfareavenue.com/f/<slug>.
   wave194 (02/10/26, Steel: forms fill in from a person's account and what they type is saved to it): when accounts are on
   and someone is signed in on this site (window.WA, site.js), the questions that fill a contact field come filled from
   their profile (account_prefill), the answers go with their own sign-in so form-submit saves them to their record, and a
   line above the form says so ("Not you?" signs out). Signed out, with accounts on, the line offers to sign in first and
   come back (/account/?next=).
   wave236 (14/10/26, Steel: the sign-up and application forms pop up over the page instead of taking up room in it): a
   form box with data-wa-popup opens in a pop-up; see Popup() at the end.
   wave261 (16/10/26, Steel: on the Holiday Gift Basket Drive page "I want it to pop up a form for each of those actions that
   they can take"): several pop-ups in one section (data-wa-popup-id names each one), and a pop-up whose launcher is just
   its button or link in the page's own card (data-wa-popup-bare="<the launcher's classes>"). */
(function () {
  'use strict';
  var B = document.body, SUPA = B.getAttribute('data-supa') || '', KEY = B.getAttribute('data-key') || '';
  var URL_FN = SUPA + '/functions/v1/form-submit';
  var PAGE_LANG = B.getAttribute('data-lang') === 'fr' ? 'fr' : 'en';
  var ACCT_URL = PAGE_LANG === 'fr' ? '/fr/compte/' : '/account/', PRIV_URL = PAGE_LANG === 'fr' ? '/fr/confidentialite/' : '/privacy/';
  var TX = {
    en: { maxN: 'Please pick at most {n}.', optional: '(optional)', send: 'Send', sending: 'Sending…', fix: 'Please check the answers marked below.', required: 'Please answer this question.', email: 'Please enter a valid email address.',
      phone: 'Please enter a phone number we can reach.', consent: 'Please tick the box to sign up.', rate: 'Too many tries from here. Please wait a few minutes and send again.',
      expired: 'This page was open a long time, so we refreshed the form. Please check your answers and send again.', server: 'Something went wrong on our side. Please try again in a minute.',
      offline: 'We could not reach Welfare Avenue. Check your connection and try again.', nodates: 'No dates are open right now. Send the form and we will reach out when new ones are set.',
      yes: 'Yes', no: 'No', thanks: 'Thank you!', closed: 'This form is closed for now. You can reach us at ', select: 'Choose…',
      privacy: 'We keep your answers in our volunteer and supporter records, use them only to work with you, and never sell or share them.', privacyLink: 'Privacy',
      acctIn: 'Signed in as {n}. We filled in what we have, and what you change here is saved to your profile.', acctMine: 'My account', acctNot: 'Not you?',
      acctOffer: 'Have an account? {a} and this form fills in for you.', acctSignIn: 'Sign in', saved: 'Your profile is updated too.',
      fileType: 'Please attach a PDF, Word document or photo.', fileBig: 'That file is over {n} MB. Please attach a smaller one.', attached: 'Attached: ', uploading: 'Uploading your file…', fileFail: 'Your file could not be uploaded. Please try again.', jd: 'Job description' },
    fr: { maxN: 'Veuillez en choisir {n} au plus.', optional: '(facultatif)', send: 'Envoyer', sending: 'Envoi…', fix: 'Veuillez vérifier les réponses indiquées ci-dessous.', required: 'Veuillez répondre à cette question.', email: 'Veuillez entrer une adresse courriel valide.',
      phone: 'Veuillez entrer un numéro où vous joindre.', consent: 'Veuillez cocher la case pour vous inscrire.', rate: 'Trop d’essais depuis cet appareil. Veuillez patienter quelques minutes.',
      expired: 'Cette page était ouverte depuis longtemps; nous avons actualisé le formulaire. Vérifiez vos réponses et envoyez de nouveau.', server: 'Un problème est survenu de notre côté. Veuillez réessayer dans une minute.',
      offline: 'Impossible de joindre Welfare Avenue. Vérifiez votre connexion et réessayez.', nodates: 'Aucune date n’est ouverte pour le moment. Envoyez le formulaire et nous vous écrirons dès que de nouvelles dates seront fixées.',
      yes: 'Oui', no: 'Non', thanks: 'Merci!', closed: 'Ce formulaire est fermé pour le moment. Vous pouvez nous écrire à ', select: 'Choisir…',
      privacy: 'Nous conservons vos réponses dans nos dossiers de bénévoles et de sympathisants, nous les utilisons seulement pour travailler avec vous et ne les vendons ni ne les partageons jamais.', privacyLink: 'Confidentialité',
      acctIn: 'Connexion : {n}. Nous avons rempli ce que nous avons, et ce que vous changez ici est enregistré dans votre profil.', acctMine: 'Mon compte', acctNot: 'Ce n’est pas vous?',
      acctOffer: 'Vous avez un compte? {a} et ce formulaire se remplit pour vous.', acctSignIn: 'Connectez-vous', saved: 'Votre profil est aussi à jour.',
      fileType: 'Veuillez joindre un PDF, un document Word ou une photo.', fileBig: 'Ce fichier dépasse {n} Mo. Veuillez en joindre un plus petit.', attached: 'Fichier joint : ', uploading: 'Envoi de votre fichier…', fileFail: 'Votre fichier n’a pas pu être envoyé. Veuillez réessayer.', jd: 'Description du poste' }
  };
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function call(method, slug, body, token) {
    var opt = { method: method, headers: { apikey: KEY, Authorization: 'Bearer ' + (token || KEY) } };
    if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch(URL_FN + (method === 'GET' ? '?slug=' + encodeURIComponent(slug) : ''), opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j || {} }; });
    });
  }
  /* wave194: the signed-in account, looked up once for every form on the page (at most 2.5 seconds, so a form never waits long) */
  var ACCT = null, MODE = 'off', FORMS = [];
  var acctReady = (function () {
    var W = window.WA;
    if (!W || !SUPA || !KEY || !window.fetch || !document.querySelector('[data-wa-form]')) return Promise.resolve();
    var look = W.config().then(function (c) {
      MODE = (c && c.mode) || 'off';
      if (MODE === 'off') return null;
      return W.session().then(function (s) {
        if (!s || !W.isAccount(s)) return null;
        return W.rpc('account_prefill', { p_lang: PAGE_LANG }, s).then(function (r) {
          var b = r.body || {};
          if (r.ok && b.linked && b.fill) ACCT = { fill: b.fill, name: b.name || '', email: b.fill.email || s.email || '' };
          return null;
        });
      });
    }).catch(function () { return null; });
    return Promise.race([look, new Promise(function (res) { setTimeout(res, 2500); })]);
  })();
  function Form(box, n) {
    var S = { form: null, org: null, token: '', lang: 'en', errors: {}, sending: false, banner: '', files: {}, uploaded: {} };
    var slugs = (box.getAttribute('data-wa-form') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var fallback = box.innerHTML, pfx = 'w' + n + '_';
    function t(k) { return (TX[S.lang] || TX.en)[k] || TX.en[k] || k; }
    function load(i, keep) {
      if (i >= slugs.length) return; // no published form: the page's own message stays
      return call('GET', slugs[i]).then(function (r) {
        if (r.status === 404) return load(i + 1, keep);
        if (r.body && r.body.closed) { S.lang = r.body.lang || S.lang; var mail = (r.body.org && r.body.org.email) || 'info@welfareavenue.com'; box.innerHTML = '<p class="waf-note">' + E(t('closed')) + '<a href="mailto:' + E(mail) + '">' + E(mail) + '</a>.</p>'; return; }
        if (r.status !== 200 || !r.body.form) return;
        S.form = r.body.form; S.org = r.body.org; S.token = r.body.token; S.lang = S.form.lang === 'fr' ? 'fr' : 'en';
        if (keep) S.banner = t('expired');
        return acctReady.then(function () { render(keep); });
      }).catch(function () { /* offline: keep the page's message */ });
    }
    function field(q, keep) {
      var id = pfx + q.id, err = S.errors[q.id], v = keep ? keep[q.id] : (ACCT && q.fill && ACCT.fill[q.fill] != null ? String(ACCT.fill[q.fill]) : undefined);
      var head = function (tag) {
        return '<' + tag + (tag === 'label' ? ' for="' + id + '"' : '') + ' id="' + id + '_l">' + E(q.label) + (q.required ? '<span class="req" aria-hidden="true">*</span>' : ' <span class="opt">' + E(t('optional')) + '</span>') + '</' + tag + '>' +
          (q.help ? '<p class="help" id="' + id + '_h">' + E(q.help) + '</p>' : '');
      };
      var desc = ((q.help ? id + '_h ' : '') + (err ? id + '_e' : '')).trim();
      var aria = (desc ? ' aria-describedby="' + desc + '"' : '') + (err ? ' aria-invalid="true"' : '') + (q.required ? ' aria-required="true"' : '');
      var e = err ? '<p class="err" id="' + id + '_e">' + E(err) + '</p>' : '';
      var cls = 'q' + (err ? ' bad' : '');
      if (q.type === 'text' || q.type === 'email' || q.type === 'phone' || q.type === 'number' || q.type === 'date') {
        var type = { text: 'text', email: 'email', phone: 'tel', number: 'number', date: 'date' }[q.type];
        var ac = q.type === 'email' ? ' autocomplete="email"' : q.type === 'phone' ? ' autocomplete="tel"' : /first/i.test(q.id) ? ' autocomplete="given-name"' : /last/i.test(q.id) ? ' autocomplete="family-name"' : '';
        return '<div class="' + cls + '" data-q="' + E(q.id) + '">' + head('label') + '<input id="' + id + '" name="' + E(q.id) + '" type="' + type + '"' + ac + aria + ' value="' + E(v || '') + '" maxlength="200">' + e + '</div>';
      }
      /* wave216: a file (a CV for an application form): the chosen file is kept in S.files so a re-render keeps it, and it is
         uploaded when the form is sent (form-submit action upload gives a one-time link into private storage) */
      if (q.type === 'file') {
        var f0 = S.files[q.id];
        return '<div class="' + cls + '" data-q="' + E(q.id) + '">' + head('label') + '<input id="' + id + '" name="' + E(q.id) + '" type="file"' + (q.accept ? ' accept="' + E(q.accept) + '"' : '') + aria + '>' +
          '<p class="waf-file small" data-waf-file="' + E(q.id) + '"' + (f0 ? '' : ' hidden') + '>' + (f0 ? E(t('attached') + f0.name) : '') + '</p>' + e + '</div>';
      }
      if (q.type === 'long_text') return '<div class="' + cls + '" data-q="' + E(q.id) + '">' + head('label') + '<textarea id="' + id + '" name="' + E(q.id) + '"' + aria + ' maxlength="2000">' + E(v || '') + '</textarea>' + e + '</div>';
      var opts = q.type === 'yes_no' ? [{ v: 'yes', l: t('yes') }, { v: 'no', l: t('no') }] : (q.options || []).map(function (o) { return typeof o === 'string' ? { v: o, l: o } : o; });
      var multi = q.type === 'multi' || q.type === 'serving_dates';
      if (q.type === 'serving_dates' && !opts.length) return '<fieldset class="' + cls + '" data-q="' + E(q.id) + '">' + head('legend') + '<p class="none">' + E(t('nodates')) + '</p></fieldset>';
      if (!multi && opts.length > 8) {
        return '<div class="' + cls + '" data-q="' + E(q.id) + '">' + head('label') + '<select id="' + id + '" name="' + E(q.id) + '"' + aria + '><option value="">' + E(t('select')) + '</option>' +
          opts.map(function (o) { return '<option value="' + E(o.v) + '"' + (v === o.v ? ' selected' : '') + '>' + E(o.l) + '</option>'; }).join('') + '</select>' + e + '</div>';
      }
      var picked = multi ? (Array.isArray(v) ? v : []) : v;
      var mx = multi && q.max ? Number(q.max) : 0, full = mx && picked.length >= mx;   /* wave244: at most q.max choices (the roles: 2) */
      return '<fieldset class="' + cls + '" data-q="' + E(q.id) + '"' + (mx ? ' data-max="' + mx + '"' : '') + (err ? ' aria-invalid="true"' : '') + (desc ? ' aria-describedby="' + desc + '"' : '') + '>' + head('legend') +
        '<div class="choices' + (opts.length > 3 && !opts.some(function (o) { return o.d; }) && opts.every(function (o) { return String(o.l).length < 28; }) ? ' two' : '') + '">' +
        opts.map(function (o, i) {
          var on = multi ? picked.indexOf(o.v) >= 0 : picked === o.v;
          return '<label class="choice"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="' + E(q.id) + '" value="' + E(o.v) + '"' + (on ? ' checked' : '') + (full && !on ? ' disabled' : '') + (i === 0 ? ' id="' + id + '"' : '') + (o.lead ? ' data-lead="1"' : '') + '><span>' + E(o.l) + (o.u ? ' <a class="jdlink" href="' + E(o.u) + '" target="_blank" rel="noopener">' + E(t('jd')) + '</a>' : '') + (o.d ? '<small class="cd">' + E(o.d) + '</small>' : '') + '</span></label>';
        }).join('') + '</div>' + (q.lead_note ? '<p class="waf-lead" data-waf-lead="' + E(q.id) + '"' + (opts.some(function (o) { return o.lead && picked === o.v; }) ? '' : ' hidden') + '>' + E(q.lead_note) + '</p>' : '') + e + '</fieldset>';
    }
    function acctLine() {
      if (ACCT) return '<p class="waf-acct">' + E(t('acctIn').replace('{n}', ACCT.name || ACCT.email)) + ' <a href="' + ACCT_URL + '">' + E(t('acctMine')) + '</a> · ' +
        '<button type="button" class="linkish" data-waf-out>' + E(t('acctNot')) + '</button></p>';
      if (MODE !== 'on') return '';
      var at = box.closest('[id]'), next = window.location.pathname + (at ? '#' + at.id : ''), parts = t('acctOffer').split('{a}');
      return '<p class="waf-acct">' + E(parts[0]) + '<a href="' + ACCT_URL + '?next=' + encodeURIComponent(next) + '">' + E(t('acctSignIn')) + '</a>' + E(parts[1] || '') + '</p>';
    }
    function limitMax(fs) {
      var n = Number(fs.getAttribute('data-max')) || 0, bs = fs.querySelectorAll('input[type="checkbox"]'), c = 0;
      Array.prototype.forEach.call(bs, function (b) { if (b.checked) c++; });
      Array.prototype.forEach.call(bs, function (b) { if (!b.checked) b.disabled = n > 0 && c >= n; });
    }
    function render(keep) {
      var f = S.form, c = f.consent || {}, cerr = S.errors._consent, heading = box.getAttribute('data-heading');
      box.innerHTML = '<form novalidate lang="' + S.lang + '">' + (heading !== 'none' ? '<h3>' + E(f.title) + '</h3>' + (f.intro ? '<p class="waf-intro">' + E(f.intro) + '</p>' : '') : '') + acctLine() +
        (S.banner ? '<div class="waf-banner ' + (Object.keys(S.errors).length ? 'warn' : 'info') + '" role="alert">' + E(S.banner) + '</div>' : '') +
        f.questions.map(function (q) { return field(q, keep); }).join('') +
        (c.ask ? '<div class="q consent' + (cerr ? ' bad' : '') + '" data-q="_consent"><label class="choice"><input type="checkbox" id="' + pfx + '_consent" name="_consent"' + (keep && keep._consent ? ' checked' : '') + (cerr ? ' aria-invalid="true" aria-describedby="' + pfx + '_consent_e"' : '') + '><span>' + E(c.label) + (c.required ? '<span class="req" aria-hidden="true">*</span>' : '') + '</span></label>' +
          (cerr ? '<p class="err" id="' + pfx + '_consent_e">' + E(cerr) + '</p>' : '') + '<p class="small">' + E((S.org && S.org.address) || 'Welfare Avenue') + ' · ' + E((S.org && S.org.email) || '') + '</p></div>' : '') +
        '<div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
        '<button type="submit" class="btn waf-send"' + (S.sending ? ' disabled' : '') + '>' + E(S.sending ? t('sending') : t('send')) + '</button>' +
        '<p class="waf-privacy">' + E(t('privacy')) + ' <a href="' + PRIV_URL + '">' + E(t('privacyLink')) + '</a></p></form>';
      box.querySelector('form').addEventListener('submit', submit);
      /* wave216d: the leadership note shows only while a leadership role is picked */
      Array.prototype.forEach.call(box.querySelectorAll('[data-waf-lead]'), function (note) {
        var name = note.getAttribute('data-waf-lead');
        Array.prototype.forEach.call(box.querySelectorAll('input[name="' + name + '"]'), function (r) {
          r.addEventListener('change', function () { var on = box.querySelector('input[name="' + name + '"]:checked'); note.hidden = !(on && on.getAttribute('data-lead') === '1'); });
        });
      });
      /* wave244: once the most choices are ticked, the others wait until one is unticked */
      Array.prototype.forEach.call(box.querySelectorAll('fieldset[data-max]'), function (fs) { fs.addEventListener('change', function () { limitMax(fs); }); });
      Array.prototype.forEach.call(box.querySelectorAll('input[type="file"]'), function (inp) {
        inp.addEventListener('change', function () {
          var f0 = inp.files && inp.files[0]; if (!f0) return;
          S.files[inp.name] = f0;
          var line = box.querySelector('[data-waf-file="' + inp.name + '"]'); if (line) { line.textContent = t('attached') + f0.name; line.hidden = false; }
        });
      });
      var out = box.querySelector('[data-waf-out]');
      if (out) out.addEventListener('click', function () { if (window.WA) window.WA.signOut(); ACCT = null; FORMS.forEach(function (fn) { fn(); }); });
    }
    FORMS.push(function () { if (S.form && !S.sending && box.querySelector('form')) render(); });
    function collect() {
      var form = box.querySelector('form'), out = {};
      S.form.questions.forEach(function (q) {
        if (q.type === 'multi' || q.type === 'serving_dates') out[q.id] = Array.prototype.map.call(form.querySelectorAll('input[name="' + q.id + '"]:checked'), function (i) { return i.value; });
        else if (q.type === 'choice' || q.type === 'yes_no') { var sel = form.querySelector('select[name="' + q.id + '"]'); var r = form.querySelector('input[name="' + q.id + '"]:checked'); out[q.id] = sel ? sel.value : (r ? r.value : ''); }
        else if (q.type === 'file') out[q.id] = S.files[q.id] ? S.files[q.id].name : '';
        else { var el = form.querySelector('[name="' + q.id + '"]'); out[q.id] = el ? el.value : ''; }
      });
      var cb = form.querySelector('input[name="_consent"]'); out._consent = !!(cb && cb.checked);
      out._hp = (form.querySelector('input[name="website"]') || {}).value || '';
      return out;
    }
    function validate(a) {
      var errs = {};
      S.form.questions.forEach(function (q) {
        var v = a[q.id], empty = v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
        if (empty) { if (q.required && !(q.type === 'serving_dates' && !(q.options || []).length)) errs[q.id] = t('required'); return; }
        if (q.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim())) errs[q.id] = t('email');
        if (q.max && Array.isArray(v) && v.length > Number(q.max)) errs[q.id] = t('maxN').replace('{n}', q.max);
        if (q.type === 'phone' && String(v).replace(/\D/g, '').length < 7) errs[q.id] = t('phone');
        if (q.type === 'file') {
          var f0 = S.files[q.id], ext = (f0.name.match(/\.[a-z0-9]{2,5}$/i) || [''])[0].toLowerCase();
          if (q.accept && q.accept.split(',').indexOf(ext) < 0) errs[q.id] = t('fileType');
          else if (q.max_mb && f0.size > q.max_mb * 1048576) errs[q.id] = t('fileBig').replace('{n}', q.max_mb);
        }
      });
      if (S.form.consent && S.form.consent.ask && S.form.consent.required && !a._consent) errs._consent = t('consent');
      return errs;
    }
    function focusFirst() {
      var k = Object.keys(S.errors)[0]; if (!k) return;
      var el = document.getElementById(pfx + k) || box.querySelector('[data-q="' + k + '"] input, [data-q="' + k + '"] textarea, [data-q="' + k + '"] select');
      if (el) { el.focus(); try { el.scrollIntoView({ block: 'center' }); } catch (e) { /* fine */ } }
    }
    function submit(ev) {
      ev.preventDefault(); if (S.sending) return;
      var a = collect();
      S.errors = validate(a);
      if (Object.keys(S.errors).length) { S.banner = t('fix'); render(a); focusFirst(); return; }
      var answers = {}; S.form.questions.forEach(function (q) { answers[q.id] = a[q.id]; });
      var fileQs = S.form.questions.filter(function (q) { return q.type === 'file' && S.files[q.id]; });
      S.sending = true; S.banner = fileQs.length ? t('uploading') : ''; render(a);
      var failed = null;
      var up = fileQs.reduce(function (p, q) {
        return p.then(function () {
          if (failed) return;
          var f0 = S.files[q.id], done = S.uploaded[q.id];
          if (done && done.file === f0) { answers[q.id] = done.id; return; }
          return call('POST', S.form.slug, { action: 'upload', slug: S.form.slug, token: S.token, qid: q.id, name: f0.name, size: f0.size, mime: f0.type }).then(function (r) {
            if (r.status !== 200 || !r.body.url) { failed = r; return; }
            return fetch(r.body.url, { method: 'PUT', headers: { 'Content-Type': r.body.mime || f0.type || 'application/octet-stream' }, body: f0 }).then(function (pr) {
              if (!pr.ok) { failed = { status: 500, body: { error: 'upload' } }; return; }
              S.uploaded[q.id] = { file: f0, id: r.body.upload_id }; answers[q.id] = r.body.upload_id;
            });
          });
        });
      }, Promise.resolve()).catch(function () { failed = { status: 0, body: {} }; });
      up.then(function () {
        if (!failed) return;
        S.sending = false; S.errors = (failed.body && failed.body.fields) || {};
        S.banner = failed.status === 0 ? t('offline') : failed.status === 429 ? t('rate') : failed.body && failed.body.error === 'expired' ? t('expired') : Object.keys(S.errors).length ? t('fix') : t('fileFail');
        if (failed.body && failed.body.error === 'expired') { load(slugs.indexOf(S.form.slug), a); return; }
        render(a); focusFirst();
      });
      up.then(function () { if (failed) return Promise.reject('stop'); })
      .then(function () {
      // wave194: a signed-in account sends its own sign-in, so form-submit saves the answers to that person's record
      return (ACCT && window.WA ? window.WA.session() : Promise.resolve(null)).then(function (s) {
        var tok = s && window.WA.isAccount(s) ? s.access_token : null;
        return call('POST', S.form.slug, { slug: S.form.slug, token: S.token, answers: answers, consent: a._consent, hp: a._hp, lang: S.lang }, tok);
      }).then(function (r) {
        S.sending = false;
        if (r.status === 200 && r.body.ok) { thanks(r.body.thank_you || S.form.thank_you, r.body.saved === true); return; }
        if (r.status === 400 && r.body.error === 'invalid') { S.errors = r.body.fields || {}; S.banner = t('fix'); render(a); focusFirst(); return; }
        if (r.status === 400 && r.body.error === 'expired') { S.errors = {}; load(slugs.indexOf(S.form.slug), a); return; }
        if (r.status === 404 || r.status === 410) { box.innerHTML = fallback; return; }
        S.banner = r.status === 429 ? t('rate') : t('server'); S.errors = {}; render(a);
      }).catch(function () { S.sending = false; S.banner = t('offline'); render(a); });
      }, function () { /* the upload failed: already shown */ })
      .catch(function () { S.sending = false; S.banner = t('offline'); render(a); });
    }
    function thanks(msg, saved) {
      box.innerHTML = '<div class="waf-done" role="status" tabindex="-1"><h3>' + E(t('thanks')) + '</h3><p class="mb0">' + E(msg) + '</p>' + (saved ? '<p class="small">' + E(t('saved')) + '</p>' : '') + '</div>';
      var d = box.querySelector('.waf-done'); try { d.focus(); d.scrollIntoView({ block: 'center' }); } catch (e) { /* fine */ }
    }
    if (SUPA && KEY && window.fetch && slugs.length) load(0);
  }
  /* wave236 (14/10/26, Steel: the sign-up and application forms pop up over the page instead of taking up room in it).
     <div data-wa-form="…" data-wa-popup="Button label" data-wa-popup-note="Optional line"> stays in the page as a short card
     (its fallback's heading, the line and the button); the form itself is built inside a <dialog> whose id is the section's
     id plus "-form" (#apply-form, #groups-form). The pop-up opens on that button, on any link on this page to the section or
     to the pop-up (#apply, #groups, #apply-form…) and when the page is opened at one of those addresses, so links from other
     pages and emails (welfareavenue.com/volunteer/#groups) land on the open form. The × , Escape and a click outside close
     it; what someone typed is kept if they reopen it. A role link on the Join page (data-pick) ticks that role in the form,
     and since wave237 so does "Apply for this role" on a Montreal role card (data-role, a value of the roles question).
     Its styles are forms.css, loaded only on pages with a pop-up. Without JavaScript the card keeps the page's own message. */
  var CSS_V = 'e5d8d961', POPS = {};
  function Popup(box, n) {
    var sec = box.closest('section[id]'), fr = PAGE_LANG === 'fr';
    /* wave261: data-wa-popup-id names the pop-up when a section holds several (#give-items opens give-items-form) */
    var pid = (box.getAttribute('data-wa-popup-id') || '').replace(/[^a-z0-9-]/gi, ''), sid = pid || (sec ? sec.id : 'waf' + n);
    var label = box.getAttribute('data-wa-popup') || (fr ? 'Ouvrir le formulaire' : 'Open the form');
    var note = box.getAttribute('data-wa-popup-note') || '';
    var bare = box.getAttribute('data-wa-popup-bare');
    var h = box.querySelector('.waf-fallback h3'), title = box.getAttribute('data-wa-popup-title') || (h ? h.textContent : label);
    var d = document.createElement('dialog'); d.className = 'waf-dialog'; d.id = sid + '-form'; d.setAttribute('aria-label', title);
    d.innerHTML = '<div class="waf-sheet"><div class="waf-bar"><button type="button" class="waf-x" aria-label="' + E(fr ? 'Fermer' : 'Close') + '">×</button></div>' +
      '<div class="form-card waf-dbody"></div></div>';
    var body = d.querySelector('.waf-dbody');
    body.setAttribute('data-wa-form', box.getAttribute('data-wa-form') || '');
    if (box.hasAttribute('data-heading')) body.setAttribute('data-heading', box.getAttribute('data-heading'));
    body.innerHTML = box.innerHTML;
    document.body.appendChild(d);
    box.removeAttribute('data-wa-form');
    if (bare != null) {
      /* wave261: only the launcher, styled like the link or button it replaces (its arrow kept) */
      var ar = box.querySelector('svg.ar'), arh = ar ? ar.outerHTML : '';
      box.classList.add('waf-bare');
      box.innerHTML = '<button type="button" class="' + E(bare || 'btn') + ' waf-open" aria-haspopup="dialog" aria-controls="' + E(d.id) + '">' + E(label) + arh + '</button>';
    } else {
      box.classList.add('waf-launch');
      box.innerHTML = '<h3>' + E(title) + '</h3>' + (note ? '<p class="waf-note">' + E(note) + '</p>' : '') +
        '<button type="button" class="btn waf-open" aria-haspopup="dialog" aria-controls="' + E(d.id) + '">' + E(label) + '</button>';
    }
    var opener = null, downOut = false;
    function open(from) {
      opener = from && from.focus ? from : document.activeElement;
      if (!d.open) { if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); }
      document.documentElement.classList.add('waf-locked');
      var pick = from && from.getAttribute ? from.getAttribute('data-pick') : null;
      if (pick) {
        var r = d.querySelector('input[name="position"][value="' + pick.replace(/["\\]/g, '') + '"]'), s = d.querySelector('select[name="position"]');
        if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } else if (s) s.value = pick;
      }
      /* wave237: "Apply for this role" on a Montreal role card (data-role) ticks that role; the others stay as they are */
      var role = from && from.getAttribute ? from.getAttribute('data-role') : null;
      if (role) {
        var c = d.querySelector('input[name="roles"][value="' + role.replace(/["\\]/g, '') + '"]');
        if (c && !c.checked && !c.disabled) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }
      }
    }
    function close() { if (!d.open) return; if (typeof d.close === 'function') d.close(); else { d.removeAttribute('open'); done(); } }
    function done() {
      document.documentElement.classList.remove('waf-locked');
      if (opener && opener.focus && document.contains(opener)) { try { opener.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
    }
    d.addEventListener('close', done);
    d.querySelector('.waf-x').addEventListener('click', close);
    // a click outside the sheet (on the dimmed page) closes it, but not a text selection dragged out of a field
    d.addEventListener('mousedown', function (e) { downOut = e.target === d; });
    d.addEventListener('click', function (e) { if (e.target === d && downOut) close(); downOut = false; });
    box.querySelector('.waf-open').addEventListener('click', function (e) { open(e.currentTarget); });
    POPS[sid] = open; POPS[d.id] = open;
    return body;
  }
  var boxes = document.querySelectorAll('[data-wa-form]');
  var pops = typeof document.createElement('dialog').showModal === 'function' && !!document.querySelector('[data-wa-form][data-wa-popup]');
  if (pops) { var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/assets/forms.css?v=' + CSS_V; document.head.appendChild(css); }
  Array.prototype.forEach.call(boxes, function (box, i) { Form(pops && box.hasAttribute('data-wa-popup') ? Popup(box, i) : box, i); });
  if (pops) {
    var here = function (u) { return u.hostname.replace(/^www\./, '') === location.hostname.replace(/^www\./, '') && u.pathname.replace(/index\.html$/, '') === location.pathname.replace(/index\.html$/, ''); };
    document.addEventListener('click', function (e) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null; if (!a) return;
      var u; try { u = new URL(a.getAttribute('href'), location.href); } catch (x) { return; }
      var go = u.hash && here(u) ? POPS[decodeURIComponent(u.hash.slice(1))] : null; if (!go) return;
      e.preventDefault(); go(a);
    });
    var fromHash = function () { var go = POPS[decodeURIComponent((location.hash || '').slice(1))]; if (go) go(); };
    fromHash(); window.addEventListener('hashchange', fromHash);
  }
})();
$w261f$;
  if md5(v) <> '545cd9b5cbc98a2d952e4c13d27b1d9a' then raise exception 'content check failed for assets/forms.js'; end if;
  update public.www_files set content = v, md5 = md5(v), updated_at = now() where path = 'assets/forms.js' and part = 0; n := n + 1;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('www_file', 'assets/forms.js', 'content', '9c3e5d97', '545cd9b5 (wave261: the drive page''s pop-up forms and gift counter)', 'Claude (16/10 drive forms)');
  if (select md5(content) from public.www_files where path = 'assets/forms.css' and part = 0) <> 'cb125b2b6bbf7b74948d25244167ceac' then raise exception 'www_files assets/forms.css moved since 17/10/26 (expected cb125b2b): rebase first'; end if;
  v := $w261f$/* Welfare Avenue website, wave236 (14/10/26, Steel: the sign-up and application forms pop up over the page instead of
   taking up room in it). Loaded by forms.js only when a page has a pop-up form (data-wa-popup); the form fields keep
   their site.css styles. On phones the pop-up fills the screen. */
html.waf-locked{overflow:hidden}

/* The short card left in the page */
.form-card.waf-launch{display:grid;justify-items:start;gap:12px;border-top:6px solid var(--gold)}
.waf-launch h3{margin:0}
.waf-launch .waf-note{margin:0}
.waf-launch .btn{margin-top:6px}

/* The pop-up */
dialog.waf-dialog{border:0;padding:0;margin:auto;width:min(680px,calc(100vw - 32px));max-width:none;
  max-height:calc(100vh - 48px);max-height:calc(100dvh - 48px);overflow:hidden;background:var(--white);color:var(--ink);
  box-shadow:0 18px 60px rgba(16,63,57,.35)}
dialog.waf-dialog::backdrop{background:rgba(16,63,57,.55)}
.waf-sheet{max-height:calc(100vh - 48px);max-height:calc(100dvh - 48px);overflow-y:auto;overscroll-behavior:contain;
  border-top:6px solid var(--gold);-webkit-overflow-scrolling:touch}
.waf-bar{position:sticky;top:0;z-index:2;height:0;display:flex;justify-content:flex-end}
.waf-x{flex:none;width:44px;height:44px;margin:10px 10px 0 0;border:0;border-radius:50%;background:rgba(255,255,255,.94);
  color:var(--green);font-size:30px;line-height:1;cursor:pointer;box-shadow:0 1px 6px rgba(16,63,57,.12)}
.waf-x:hover{color:var(--purple)}
.form-card.waf-dbody{border:0;padding:30px 22px 26px}
@media (min-width:640px){.form-card.waf-dbody{padding:40px 40px 32px}}
.waf-dbody h3{margin-right:44px}
@media (max-width:639px){
  dialog.waf-dialog{width:100vw;height:100vh;height:100dvh;max-height:100vh;max-height:100dvh;margin:0}
  .waf-sheet{height:100vh;height:100dvh;max-height:100vh;max-height:100dvh}
}
@media (prefers-reduced-motion:no-preference){
  dialog.waf-dialog[open]{animation:waf-in .18s ease-out}
  @keyframes waf-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
}

/* wave237 (14/10/26, Steel: describe each role so people know what they will do before signing up): the "What you'll do"
   panel on the Montreal role cards of the volunteer page (details.more from site.css, made a little tighter in a card) */
.role details.more{margin-top:18px}
.role details.more>summary{padding:14px 18px;font-size:18px}
.role details.more>.in{padding:0 18px 18px}
.role details.more .ticks{margin-top:2px;font-size:15.5px;line-height:1.55}
.role .role-bring{margin:14px 0 0;font-size:15.5px;line-height:1.55}
#roles .roles{align-items:start}

/* wave244: what each role involves, under its name; a role that cannot be picked while two are ticked */
.waf .choice small.cd,.waf-dialog .choice small.cd{display:block;margin-top:3px;font-size:12.5px;line-height:1.4;color:#5b5a57;font-weight:400}
.waf .choice input:disabled+span,.waf-dialog .choice input:disabled+span{opacity:.45}

/* wave261: a pop-up whose launcher is the card's own link or button (the Holiday Gift Basket Drive page) */
.waf-bare{display:contents}
button.textlink.waf-open{background:none;border:0;padding:0;font:inherit;font-size:15px;font-weight:500;color:var(--green);cursor:pointer;text-align:left}
.way button.textlink.waf-open{margin-top:auto;padding-top:20px}
button.textlink.waf-open:hover{text-decoration:underline}
button.textlink.waf-open:focus-visible,button.btn.waf-open:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
$w261f$;
  if md5(v) <> 'e5d8d961d8dbf0847717180e329d4531' then raise exception 'content check failed for assets/forms.css'; end if;
  update public.www_files set content = v, md5 = md5(v), updated_at = now() where path = 'assets/forms.css' and part = 0; n := n + 1;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('www_file', 'assets/forms.css', 'content', 'cb125b2b', 'e5d8d961 (wave261: the drive page''s pop-up forms and gift counter)', 'Claude (16/10 drive forms)');
  if (select md5(content) from public.www_files where path = 'assets/drive.js' and part = 0) <> '55450472bc74e26edb2f3b3afe1e9715' then raise exception 'www_files assets/drive.js moved since 17/10/26 (expected 55450472): rebase first'; end if;
  v := $w261f$/* Welfare Avenue website: campaign pages (15/10/26, the Holiday Gift Basket Drive page). Draws a campaign's progress from
   the Hub (rpc www_campaign_totals: raised, donors, gifts, the goals; aggregates only, anonymous by design) into the block
   marked data-campaign="<slug>". The page's own words stay when the Hub cannot be reached. A bar shows only when the
   campaign has a money goal in the Hub (app_config donate_campaigns). After a gift in the donation popup (give/embed.js sends
   wa-donate-done), the progress is read again a few seconds later, once Stripe has told the Hub.
   wave261 (16/10/26, Steel: "this should be editable"): the gifts collected so far toward the gift goal, under the goal
   (the block marked data-dr-gifts): gifts_in from the same call, which counts the batches the team marked received in the
   Fundraising app and the pledges they confirmed (never an unconfirmed pledge from a form). Hidden while it is 0.
   No inline scripts or styles: the Content-Security-Policy allows neither. */
(function () {
  'use strict';
  var box = document.querySelector('[data-campaign]');
  if (!box || !window.fetch) return;
  var B = document.body, FR = (B.getAttribute('data-lang') || 'en') === 'fr', SUPA = B.getAttribute('data-supa') || '', KEY = B.getAttribute('data-key') || '';
  var slug = box.getAttribute('data-campaign') || '';
  var gbox = document.querySelector('[data-dr-gifts="' + slug + '"]');
  if (!SUPA || !KEY || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(slug)) return;
  var T = FR ? {
    first: 'Soyez parmi les premiers à donner à la collecte cette année.',
    people: function (n) { return n === 1 ? 'Une personne a donné jusqu’ici. Merci!' : num(n) + ' personnes ont donné jusqu’ici. Merci!'; },
    of: function (r, g) { return r + ' sur ' + g; },
    way: function (p, g) { return p + '\u00a0% du chemin vers nos ' + g + ' cadeaux'; },
    gof: function (n, g) { return n + ' cadeaux recueillis sur ' + g; }
  } : {
    first: 'Be one of the first to give to this year’s drive.',
    people: function (n) { return n === 1 ? 'One person has given so far. Thank you!' : num(n) + ' people have given so far. Thank you!'; },
    of: function (r, g) { return r + ' of ' + g; },
    way: function (p, g) { return p + '% of the way to ' + g + ' gifts'; },
    gof: function (n, g) { return n + ' gifts collected of ' + g; }
  };
  function num(n) { try { return Number(n || 0).toLocaleString(FR ? 'fr-CA' : 'en-CA'); } catch (e) { return String(n || 0); } }
  function money(n) {
    var v = Number(n) || 0;
    try { return v.toLocaleString(FR ? 'fr-CA' : 'en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
    catch (e) { return FR ? Math.floor(v) + ' $' : '$' + Math.floor(v); }
  }
  function el(k) { return box.querySelector('[data-dr="' + k + '"]'); }
  function paint(d) {
    var raised = Math.floor(Number(d.raised) || 0), donors = Number(d.donors) || 0, goal = Number(d.goal) || 0;
    var r = el('raised'), p = el('people'), bar = el('bar'), fill = el('fill');
    if (r) r.textContent = goal > 0 ? T.of(money(raised), money(goal)) : money(raised);
    if (p) p.textContent = donors > 0 ? T.people(donors) : T.first;
    if (bar && fill) {
      if (goal > 0) {
        var pct = Math.max(0, Math.min(100, Math.round(raised / goal * 100)));
        bar.hidden = false; bar.setAttribute('aria-valuenow', String(pct));
        fill.style.width = (raised > 0 ? Math.max(pct, 2) : 0) + '%';
      } else bar.hidden = true;
    }
    box.setAttribute('data-loaded', '1');
    paintGifts(d);
  }
  /* wave261: the gift counter */
  function paintGifts(d) {
    if (!gbox) return;
    var n = Math.floor(Number(d.gifts_in) || 0), g = Math.floor(Number(d.gift_goal) || 0);
    if (n <= 0) { gbox.hidden = true; return; }
    var nb = gbox.querySelector('[data-dr="gifts-n"]'), bar = gbox.querySelector('[data-dr="gifts-bar"]'), fill = gbox.querySelector('[data-dr="gifts-fill"]'), way = gbox.querySelector('[data-dr="gifts-way"]');
    if (nb) nb.textContent = num(n);
    if (bar && fill && g > 0) {
      var pct = Math.max(0, Math.min(100, n / g * 100));
      bar.hidden = false; bar.setAttribute('aria-valuemax', String(g)); bar.setAttribute('aria-valuenow', String(Math.min(n, g)));
      bar.setAttribute('aria-valuetext', T.gof(num(n), num(g)));
      fill.style.width = Math.max(pct, 1.5) + '%';
      if (way) { way.textContent = T.way(pct >= 10 || pct === 0 ? Math.round(pct) : Math.round(pct * 10) / 10, num(g)); way.hidden = false; }
    } else if (bar) { bar.hidden = true; if (way) way.hidden = true; }
    gbox.hidden = false;
  }
  function load() {
    fetch(SUPA + '/rest/v1/rpc/www_campaign_totals', {
      method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_slug: slug })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && !d.error) paint(d); })
      .catch(function () { /* the page's own words stay */ });
  }
  load();
  window.addEventListener('wa-donate-done', function () { setTimeout(load, 5000); setTimeout(load, 20000); });
})();
$w261f$;
  if md5(v) <> '1de7b1df53f011914e99dbe8aa9193a8' then raise exception 'content check failed for assets/drive.js'; end if;
  update public.www_files set content = v, md5 = md5(v), updated_at = now() where path = 'assets/drive.js' and part = 0; n := n + 1;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('www_file', 'assets/drive.js', 'content', '55450472', '1de7b1df (wave261: the drive page''s pop-up forms and gift counter)', 'Claude (16/10 drive forms)');
  if (select md5(content) from public.www_files where path = 'assets/drive.css' and part = 0) <> 'f128fdcf29f3ba68d1f32a0728dacd10' then raise exception 'www_files assets/drive.css moved since 17/10/26 (expected f128fdcf): rebase first'; end if;
  v := $w261f$/* Welfare Avenue website: campaign pages (15/10/26, the Holiday Gift Basket Drive page, /gift-basket-drive/ and
   /fr/paniers-cadeaux/). Loaded only by those pages, after site.css; reuses its tokens. No inline styles (CSP). */
.drp{display:grid;gap:40px;align-items:stretch}
@media (min-width:900px){.drp{grid-template-columns:1fr 1fr;gap:64px}}
.drp-goal{align-self:center}
.drp-big{margin:0;font-family:var(--hf);font-weight:600;font-size:clamp(72px,9vw,120px);line-height:.95;color:var(--green);letter-spacing:-.5px}
.drp-big+p{margin:10px 0 0;font-family:var(--hf);font-weight:600;font-size:clamp(22px,2.2vw,28px);line-height:1.2;color:var(--green);max-width:18em}
.drp-goal .fine{margin:18px 0 0}
.drp-card{background:var(--sand);border-top:4px solid var(--gold);padding:30px 30px 28px;display:flex;flex-direction:column}
.drp-card .over{margin-bottom:8px}
.drp-raised{margin:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 12px}
.drp-raised b{font-family:var(--hf);font-weight:600;font-size:clamp(46px,5vw,60px);line-height:1;color:var(--green)}
.drp-raised span{font-family:var(--hf);font-weight:600;font-size:21px;color:var(--green)}
.drp-people{margin:12px 0 0;font-size:16px}
.drp-bar{position:relative;height:12px;margin:18px 0 6px;background:rgba(16,63,57,.12);overflow:hidden}
.drp-bar[hidden]{display:none}
.drp-bar span{position:absolute;left:0;top:0;bottom:0;width:0;background:var(--green);transition:width .8s ease}
.drp-card .btn{width:100%;justify-content:center;margin-top:24px}
.drp-card .fine{margin:14px 0 0}
.drt{list-style:none;margin:0;padding:0;display:grid;gap:24px;counter-reset:drt}
@media (min-width:860px){.drt{grid-template-columns:repeat(3,1fr);gap:28px}}
.drt li{counter-increment:drt;border-top:1px solid var(--rule);padding-top:20px}
.drt li::before{content:counter(drt,decimal-leading-zero);display:block;font-family:var(--hf);font-weight:600;font-size:18px;color:var(--gold);margin-bottom:6px}
.drt h3{margin:0 0 8px;font-size:26px}
.drt p{margin:0}
.drg{grid-template-columns:repeat(2,1fr)}
.drg button:last-child{grid-column:1 / -1}
.drg button:last-child img{aspect-ratio:4/3}
@media (min-width:860px){.drg{grid-template-columns:repeat(5,1fr)}.drg button:last-child{grid-column:auto}.drg img,.drg button:last-child img{aspect-ratio:3/4}}
.drw .way p+p{margin-top:12px}
.drw .way .fine{font-size:14px}
/* wave261 (16/10/26): the gifts collected so far, under the goal; hidden while it is 0 */
.drp-gifts{margin-top:26px;padding-top:22px;border-top:1px solid var(--rule)}
.drp-gifts[hidden],.drp-gifts [hidden]{display:none}
.drp-gn{margin:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 12px}
.drp-gn b{font-family:var(--hf);font-weight:600;font-size:clamp(44px,4.6vw,58px);line-height:1;color:var(--green)}
.drp-gn span{font-family:var(--hf);font-weight:600;font-size:21px;color:var(--green)}
.drp-gifts .drp-bar{margin:16px 0 0;max-width:30em}
.drp-gifts .drp-bar span{background:var(--gold)}
.drp-gifts .fine{margin:10px 0 0}
/* gl: "what your gift provides" (17/10/26, gbd_gift_ladder.py): a cream band of six gift tags after "Three ways to get involved".
   A tag is the li: ::before draws its outline (the tag's shape, cut corners and the hole), ::after its paper and the gold
   eyelet; the "Give" link covers the whole tag (a::after), so the tag is one click and one tab stop, and the focus ring
   sits on the tag. Three columns from 900px, two from 600px, one on a phone (a tag on its side, the hole on the left). */
.on-cream{background:var(--cream)}
.gl-head{position:relative;max-width:800px;margin:0 0 56px}
.gl-head h2{margin:0 0 14px}
.gl-head .lede{margin:0;max-width:44em}
.gl-heart{position:absolute;width:64px;height:auto;left:-80px;top:-20px;transform:rotate(-10deg)}
@media (max-width:1359px){.gl-heart{position:static;width:52px;margin:0 0 10px -4px}}
.gtags{list-style:none;margin:0;padding:0;display:grid;gap:22px;grid-template-columns:1fr}
@media (min-width:600px){.gtags{grid-template-columns:repeat(2,1fr);gap:56px 24px}}
@media (min-width:900px){.gtags{grid-template-columns:repeat(3,1fr);gap:60px 28px}}
.gt{--cut:22px;--paper:var(--white);--edge:var(--line);--hx:50%;--hy:28px;position:relative;isolation:isolate;display:flex;flex-direction:column;
  padding:62px 28px 26px;color:var(--ink);transition:transform .25s ease}
.gt::before,.gt::after{content:"";position:absolute;z-index:-1;pointer-events:none}
.gt::before{inset:0;background:radial-gradient(circle at var(--hx) var(--hy),transparent 0 6px,var(--edge) 6.5px);
  clip-path:polygon(var(--cut) 0,calc(100% - var(--cut)) 0,100% var(--cut),100% 100%,0 100%,0 var(--cut))}
.gt::after{inset:1px;background:radial-gradient(circle at var(--hx) calc(var(--hy) - 1px),transparent 0 7px,var(--gold) 7.5px 10px,transparent 10.5px),
  radial-gradient(circle at var(--hx) calc(var(--hy) - 1px),transparent 0 7px,var(--paper) 7.5px);
  clip-path:polygon(calc(var(--cut) - .4px) 0,calc(100% - var(--cut) + .4px) 0,100% calc(var(--cut) - .4px),100% 100%,0 100%,0 calc(var(--cut) - .4px))}
.gt-amt{margin:0;font-family:var(--hf);font-weight:600;font-size:clamp(52px,5vw,66px);line-height:1;color:var(--green);letter-spacing:-.3px}
.gt-t{margin:14px 0 8px;font-size:clamp(23px,2vw,27px)}
.gt-d{margin:0;font-size:15.5px;line-height:1.55}
.gt-go{display:inline-flex;align-items:center;gap:10px;margin-top:auto;padding-top:22px;font-family:var(--hf);font-weight:600;font-size:20px;
  line-height:1.1;color:var(--green);text-decoration:none}
.gt-go .ar{width:18px;height:14px;flex:none;transition:transform .25s ease}
.gt-go::after{content:"";position:absolute;inset:0;z-index:1}
.gt-go:focus-visible{outline:0}
.gt:focus-within{outline:3px solid var(--gold);outline-offset:4px}
.gt-go:hover{text-decoration:none}
@media (hover:hover){.gt:hover{transform:translateY(-4px) rotate(-.8deg)}.gt:hover .gt-go{text-decoration:underline;text-decoration-color:var(--gold)}.gt:hover .gt-go .ar{transform:translateX(4px)}}
.gt-top{--paper:var(--green);--edge:var(--green);color:var(--white)}
.gt-top .gt-amt{color:var(--gold)}
.gt-top .gt-t,.gt-top .gt-go{color:var(--white)}
.gt-str{position:absolute;left:calc(var(--hx) - 20px);top:calc(var(--hy) - 60px);width:40px;height:64px;z-index:1;pointer-events:none;overflow:visible}
.gt-str path{fill:none;stroke:var(--gold);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.gt-star{position:absolute;right:-14px;top:-24px;width:64px;height:auto;transform:rotate(12deg);z-index:2;pointer-events:none}
.gl-foot{margin-top:36px;display:grid;gap:14px;max-width:760px}
.gl-foot .textlink{font-size:16px}
.gl-foot .fine{margin:0}
@media (max-width:599px){
  .gt{--cut:20px;--hx:27px;--hy:50%;padding:20px 20px 22px 58px;display:grid;grid-template-columns:1fr auto;align-items:center;column-gap:12px}
  .gt>*{grid-column:1 / -1}
  .gt>.gt-amt{grid-column:1;grid-row:1}
  .gt>.gt-go{grid-column:2;grid-row:1;padding-top:0;margin:0}
  .gt-str{display:none}
  .gt-gm{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
  .gt::before{clip-path:polygon(var(--cut) 0,100% 0,100% 100%,var(--cut) 100%,0 calc(100% - var(--cut)),0 var(--cut))}
  .gt::after{background:radial-gradient(circle at calc(var(--hx) - 1px) 50%,transparent 0 7px,var(--gold) 7.5px 10px,transparent 10.5px),
    radial-gradient(circle at calc(var(--hx) - 1px) 50%,transparent 0 7px,var(--paper) 7.5px);
    clip-path:polygon(calc(var(--cut) - .4px) 0,100% 0,100% 100%,calc(var(--cut) - .4px) 100%,0 calc(100% - var(--cut) + .4px),0 calc(var(--cut) - .4px))}
  .gt-amt{font-size:46px}
  .gt-t{margin:10px 0 6px;font-size:23px}
  .gt-star{right:-6px;top:-20px;width:52px}
}
$w261f$;
  if md5(v) <> 'b02224f2135916026d64a8ce3d5abe3e' then raise exception 'content check failed for assets/drive.css'; end if;
  update public.www_files set content = v, md5 = md5(v), updated_at = now() where path = 'assets/drive.css' and part = 0; n := n + 1;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('www_file', 'assets/drive.css', 'content', 'f128fdcf', 'b02224f2 (wave261: the drive page''s pop-up forms and gift counter)', 'Claude (16/10 drive forms)');
  perform public.call_edge('www-sync');
  raise notice 'wave261 website: % files replaced, www-sync called', n;
end $deploy$;
