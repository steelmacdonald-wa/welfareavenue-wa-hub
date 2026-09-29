/* =====================================================================
   WA v167 The onboarding journey (29/09/26)
   =====================================================================
   Steel (29/09/26): "Make the onboarding interactive with our branding highlighted everywhere. Use photos and make it the
   best most educational onboarding possible."

   The plan in the Avenue Academy (#training/onboarding, the sheet wave122 draws and wave166 fills) becomes a journey:
   - a welcome with a real photo, the logo and a doodle, the person's first name, their day, how far they are (a ring) and
     Continue (the next step: the week opens, the step shows, folded or not);
   - the avenue: the weeks as stops on a road (photo, title, how far), the E that moves standing at the week they are in;
     choosing a stop shows that week;
   - each week: its photo and due date, what you will learn and why it matters (app_config onboarding_journey, with the same
     values here as a fallback), the lesson that opens it (an Academy lesson with a knowledge check; its step ticks itself),
     then the week's steps (wave166's plan, one week at a time);
   - your people (your lead from the org chart, your team, our co-executive directors, with their photos), Welfare Avenue in
     numbers, a moment from our story (Did you know?), and Ask for help;
   - a celebration when a week is finished (and when the whole plan is).
   The lessons' photos: a 'photo' and a 'photos' block in wave122's lessons (122). Data: wa167_journey.
   ===================================================================== */
(function () {
  if (window.__wa167) return; window.__wa167 = true;
  var GREEN = '#103F39', GOLD = '#DCA527', CREAM = '#FFFAF2', PURPLE = '#6F64AB', TEAL = '#2A8C7A', INK = '#1F201E', FLAG = '#B3402F', MUTED = '#797773';
  var ST = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/';
  var BR = {
    logo: ST + 'brand/logo-lockup-cream-600.png', e: ST + 'brand/e-large-gold-600.png', star: ST + 'brand/doodle-star-gold.png',
    ast: ST + 'brand/doodle-asterisk-cream.png', heart: ST + 'brand/doodle-heart-purple.png',
    flowers: ST + 'brand/doodle-flowers-gold.png', arrow: ST + 'brand/doodle-arrow-gold.png', blob: ST + 'brand/doodle-blob-purple.png'
  };
  var DEF = /*JOURNEY_DEFAULTS*/null;
  var ORDER = ['WEEK 1', 'WEEK 2', 'WEEK 3', 'WEEK 4', '60 DAYS'];
  var LABEL = { 'WEEK 1': 'Week 1', 'WEEK 2': 'Week 2', 'WEEK 3': 'Week 3', 'WEEK 4': 'Week 4', '60 DAYS': '60 days' };
  var S = { cfg: null, cfgAt: 0, ppl: null, pplAt: 0, story: null, storyI: 0, wk: null, onb: null, counts: {}, restore: null, first: true };
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function T(msg) { try { if (typeof toast === 'function') toast(msg); } catch (e) { /* fine */ } }
  function todayIso() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function fmtDay(iso) { if (!iso) return ''; try { return new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }); } catch (e) { return String(iso).slice(0, 10); } }
  function dayN(start) { if (!start) return 1; var a = new Date(String(start).slice(0, 10) + 'T12:00:00Z'), b = new Date(todayIso() + 'T12:00:00Z'); return Math.max(1, Math.round((b - a) / 86400000) + 1); }
  function initials(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join(''); }
  function first(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  function teamName(d) { try { return (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[d]) || d || ''; } catch (e) { return d || ''; } }
  function reduced() { try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* fine */ } }
  function photoUrl(p) { return p ? (/^https:/.test(p) ? p : ST + String(p).replace(/^\/+/, '')) : ''; }
  function bgPos(x) { return Math.round(100 * (x && x.fx != null ? Number(x.fx) : 0.5)) + '% ' + Math.round(100 * (x && x.fy != null ? Number(x.fy) : 0.5)) + '%'; }
  function cfg() {
    var c = S.cfg || DEF || {}, d = DEF || {};
    return { hero: c.hero || d.hero || {}, weeks: Object.assign({}, d.weeks || {}, c.weeks || {}), numbers: c.numbers || d.numbers || [], numbers_note: c.numbers_note || d.numbers_note || '' };
  }

  var BAR = function (pct) { return '<i class="w167bar"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></i>'; };
  function ring(pct, size, stroke) {
    var r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="rgba(255,250,242,.22)" stroke-width="' + stroke + '"/>'
      + '<circle class="arc" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + GOLD + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>';
  }

  var D = "'Barlow Condensed',sans-serif";
  var CSS = ''
    /* the sheet in journey mode */
    + '#w122sheet .sh.w167 .main .wrap.w167j{max-width:1080px;padding-top:22px;}'
    + '#w122sheet .sh.w167 .main .wrap.w167j > .prose{display:none;}'
    + '.w167 h1,.w167 h2,.w167 h3.w167d{font-family:' + D + ';text-transform:uppercase;letter-spacing:.4px;font-weight:700;}'
    + '.w167btn{display:inline-flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:11px 20px;font-weight:700;font-size:14px;line-height:1.1;font-family:inherit;cursor:pointer;background:' + GOLD + ';color:' + GREEN + ';box-shadow:0 10px 24px -12px rgba(0,0,0,.5);transition:transform .15s ease,box-shadow .15s ease;}'
    + '.w167btn:hover{transform:translateY(-1px);box-shadow:0 14px 28px -12px rgba(0,0,0,.55);}'
    + '.w167btn.ghost{background:rgba(255,250,242,.14);color:' + CREAM + ';box-shadow:none;border:1px solid rgba(255,250,242,.35);}'
    + '.w167btn.green{background:' + GREEN + ';color:' + CREAM + ';}'
    + '.w167bar{display:block;height:6px;border-radius:99px;background:rgba(16,63,57,.12);overflow:hidden;}.w167bar > i{display:block;height:100%;border-radius:99px;background:' + GOLD + ';transition:width .6s ease;}'
    /* the welcome */
    + '.w167hero{position:relative;border-radius:26px;overflow:hidden;min-height:300px;display:flex;align-items:flex-end;gap:24px;padding:30px 34px;color:' + CREAM + ';background-color:' + GREEN + ';background-size:cover;box-shadow:0 30px 60px -34px rgba(16,63,57,.9);}'
    + '.w167hero:before{content:"";position:absolute;inset:0;background:linear-gradient(100deg,rgba(16,63,57,.97) 0%,rgba(16,63,57,.86) 42%,rgba(16,63,57,.35) 78%,rgba(16,63,57,.2) 100%);}'
    + '.w167hero > *{position:relative;}'
    + '.w167hero .lg{position:absolute;top:24px;left:34px;height:40px;width:auto;}'
    + '.w167hero .dd1{position:absolute;top:18px;right:26px;width:64px;transform:rotate(12deg);opacity:.95;}'
    + '.w167hero .tx{flex:1;min-width:0;padding-top:64px;}'
    + '.w167hero .ey{font-size:12px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:' + GOLD + ';}'
    + '.w167hero h1{margin:6px 0 2px;font-size:56px;line-height:.95;color:' + CREAM + ';}'
    + '.w167hero h1 span{color:' + GOLD + ';}'
    + '.w167hero p{margin:0 0 6px;font-size:15px;line-height:1.5;max-width:560px;color:rgba(255,250,242,.92);}'
    + '.w167hero .tag{font-family:' + D + ';font-size:19px;letter-spacing:.6px;text-transform:uppercase;color:' + CREAM + ';opacity:.85;margin:10px 0 16px;}'
    + '.w167hero .cta{display:flex;flex-wrap:wrap;gap:10px;align-items:center;}'
    + '.w167hero .rg{flex:0 0 auto;position:relative;width:132px;height:132px;margin-bottom:6px;}'
    + '.w167hero .rg .in{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;}'
    + '.w167hero .rg b{font-family:' + D + ';font-size:36px;line-height:1;color:' + CREAM + ';}'
    + '.w167hero .rg span{font-size:11px;letter-spacing:.4px;color:rgba(255,250,242,.8);}'
    /* the avenue */
    + '.w167road{position:relative;margin:24px 0 8px;padding:22px 10px 8px;}'
    + '.w167road .lane{position:absolute;left:44px;right:44px;top:66px;height:12px;border-radius:99px;background:' + GREEN + ';}'
    + '.w167road .lane:after{content:"";position:absolute;left:10px;right:10px;top:5px;height:2px;background:repeating-linear-gradient(90deg,' + GOLD + ' 0 14px,transparent 14px 26px);opacity:.9;}'
    + '.w167road .lane i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:' + GOLD + ';opacity:.35;transition:width .6s ease;}'
    + '.w167road .stops{position:relative;display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}'
    + '.w167stop{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:0;padding:0 4px 8px;cursor:pointer;font-family:inherit;color:' + INK + ';text-align:center;border-radius:18px;}'
    + '.w167stop:focus-visible{outline:3px solid ' + GOLD + ';outline-offset:2px;}'
    + '.w167stop .pic{width:84px;height:84px;border-radius:50%;background-size:cover;background-color:' + GREEN + ';border:5px solid ' + CREAM + ';box-shadow:0 0 0 3px rgba(16,63,57,.2),0 12px 24px -14px rgba(0,0,0,.6);transition:transform .2s ease,box-shadow .2s ease;position:relative;}'
    + '.w167stop:hover .pic{transform:translateY(-3px) scale(1.04);}'
    + '.w167stop.on .pic{box-shadow:0 0 0 4px ' + GOLD + ',0 16px 30px -14px rgba(0,0,0,.7);}'
    + '.w167stop.done .pic:after{content:"\\2713";position:absolute;right:-6px;bottom:-4px;width:26px;height:26px;border-radius:50%;background:' + TEAL + ';color:' + CREAM + ';font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;border:3px solid ' + CREAM + ';}'
    + '.w167stop .lb{margin-top:6px;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:' + MUTED + ';}'
    + '.w167stop.on .lb{color:' + PURPLE + ';}'
    + '.w167stop b{font-family:' + D + ';font-size:21px;line-height:1;text-transform:uppercase;color:' + GREEN + ';}'
    + '.w167stop .n{font-size:11.5px;color:' + MUTED + ';}'
    + '.w167stop .w167bar{width:70%;margin-top:3px;}'
    + '.w167stop .e{position:absolute;top:-24px;left:50%;width:46px;margin-left:-23px;filter:drop-shadow(0 4px 6px rgba(0,0,0,.25));}'
    + '.w167stop.cur .e{animation:w167bob 1.8s ease-in-out infinite;}'
    + '@keyframes w167bob{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}'
    + '.w167road .hint{margin:6px 0 0;text-align:center;font-size:12.5px;color:' + MUTED + ';}'
    /* a week */
    + '.w167wk{margin:18px 0 8px;}'
    + '.w167ban{position:relative;border-radius:24px;overflow:hidden;min-height:180px;display:flex;align-items:flex-end;padding:22px 26px;color:' + CREAM + ';background-color:' + GREEN + ';background-size:cover;}'
    + '.w167ban:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(16,63,57,.95) 0%,rgba(16,63,57,.7) 45%,rgba(16,63,57,.1) 100%);}'
    + '.w167ban > *{position:relative;}'
    + '.w167ban .k{font-size:12px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;color:' + GOLD + ';}'
    + '.w167ban h2{margin:2px 0 4px;font-size:44px;line-height:1;color:' + CREAM + ';}'
    + '.w167ban p{margin:0;font-size:13.5px;color:rgba(255,250,242,.88);}'
    + '.w167ban .dd{position:absolute;right:24px;top:20px;width:54px;opacity:.9;}'
    + '.w167ban .pb{width:220px;max-width:60vw;margin-top:10px;}.w167ban .pb .w167bar{background:rgba(255,250,242,.25);}'
    + '.w167learn{display:grid;grid-template-columns:1.25fr 1fr;gap:16px;margin:16px 0;}'
    + '.w167learn .ob,.w167learn .wy{border-radius:20px;padding:18px 20px;}'
    + '.w167learn .ob{background:' + CREAM + ';box-shadow:0 14px 34px -26px rgba(16,63,57,.8);border:1px solid rgba(16,63,57,.08);}'
    + '.w167learn .wy{background:linear-gradient(145deg,' + PURPLE + ',#8b80c9);color:' + CREAM + ';position:relative;overflow:hidden;}'
    + '.w167learn .wy img{position:absolute;right:-10px;bottom:-12px;width:90px;opacity:.35;}'
    + '.w167learn h3{margin:0 0 10px;font-family:' + D + ';font-size:20px;text-transform:uppercase;letter-spacing:.4px;color:' + GREEN + ';}'
    + '.w167learn .wy h3{color:' + CREAM + ';}'
    + '.w167learn ul{list-style:none;margin:0;padding:0;display:grid;gap:9px;}'
    + '.w167learn li{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.45;color:' + INK + ';}'
    + '.w167learn li:before{content:"\\2713";flex:0 0 22px;height:22px;border-radius:50%;background:' + GOLD + ';color:' + GREEN + ';font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;margin-top:1px;}'
    + '.w167learn .wy p{margin:0;font-size:14px;line-height:1.55;position:relative;}'
    + '.w167feat{display:flex;gap:16px;align-items:center;border-radius:20px;padding:16px 18px;margin:0 0 16px;background:' + GREEN + ';color:' + CREAM + ';box-shadow:0 18px 40px -28px rgba(16,63,57,.9);position:relative;overflow:hidden;}'
    + '.w167feat .ic{flex:0 0 54px;height:54px;border-radius:16px;background:' + GOLD + ';display:flex;align-items:center;justify-content:center;font-family:' + D + ';font-size:26px;color:' + GREEN + ';}'
    + '.w167feat .tx{flex:1;min-width:0;}'
    + '.w167feat .tx span{display:block;font-size:11.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:' + GOLD + ';}'
    + '.w167feat .tx b{display:block;font-size:17px;margin:2px 0;}'
    + '.w167feat .tx em{font-style:normal;font-size:13px;color:rgba(255,250,242,.8);}'
    + '.w167feat.ok{background:linear-gradient(135deg,' + TEAL + ',' + GREEN + ');}'
    + '.w167feat.ok .ic{background:' + CREAM + ';color:' + TEAL + ';}'
    + '.w167steps h3{margin:18px 0 8px;font-family:' + D + ';font-size:20px;text-transform:uppercase;letter-spacing:.4px;color:' + GREEN + ';}'
    /* one week of the plan at a time; the week's lesson shows as the card above */
    + '.sh.w167 .onbwrap details.w37week{display:none;}'
    + '.sh.w167 .onbwrap details.w37week.w167on{display:block;}'
    + '.sh.w167 .onbwrap details.w37week.w167on > summary{display:none;}'
    + '.sh.w167 .onbwrap [data-w166t^="wa167w"]{display:none !important;}'
    + '.sh.w167 .w37step.w167flash{animation:w167flash 1.6s ease;}'
    + '@keyframes w167flash{0%,100%{background:transparent;}20%,60%{background:rgba(220,165,39,.28);}}'
    /* your people, our numbers, a moment from our story */
    + '.w167sec{margin:26px 0 8px;}'
    + '.w167sec > h3{margin:0 0 12px;font-family:' + D + ';font-size:24px;text-transform:uppercase;letter-spacing:.4px;color:' + GREEN + ';display:flex;align-items:center;gap:10px;}'
    + '.w167sec > h3 img{width:30px;}'
    + '.w167ppl{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;}'
    + '.w167pc{display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:18px;background:' + CREAM + ';border:1px solid rgba(16,63,57,.08);box-shadow:0 12px 28px -24px rgba(16,63,57,.8);cursor:pointer;text-align:left;font-family:inherit;color:' + INK + ';transition:transform .15s ease;}'
    + '.w167pc:hover{transform:translateY(-2px);}'
    + '.w167pc .av{flex:0 0 52px;height:52px;border-radius:50%;background:' + GREEN + ' center/cover;color:' + CREAM + ';display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;border:3px solid ' + CREAM + ';box-shadow:0 0 0 2px ' + GOLD + ';}'
    + '.w167pc .t{min-width:0;}.w167pc .t b{display:block;font-size:14px;}.w167pc .t span{display:block;font-size:12px;color:' + MUTED + ';line-height:1.35;}'
    + '.w167pc .t em{display:inline-block;font-style:normal;font-size:10.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:' + PURPLE + ';margin-bottom:2px;}'
    + '.w167team{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;}'
    + '.w167team button{display:flex;flex-direction:column;align-items:center;gap:4px;width:74px;background:none;border:0;cursor:pointer;font-family:inherit;color:' + INK + ';font-size:11.5px;}'
    + '.w167team .av{width:50px;height:50px;border-radius:50%;background:' + TEAL + ' center/cover;color:' + CREAM + ';display:flex;align-items:center;justify-content:center;font-weight:800;border:3px solid ' + CREAM + ';box-shadow:0 6px 14px -8px rgba(0,0,0,.5);}'
    + '.w167num{position:relative;border-radius:24px;padding:24px 26px;background:' + GREEN + ';color:' + CREAM + ';overflow:hidden;}'
    + '.w167num .dd1{position:absolute;right:-14px;top:-14px;width:110px;opacity:.5;}'
    + '.w167num .dd2{position:absolute;left:44%;bottom:-18px;width:80px;opacity:.35;}'
    + '.w167num .g{position:relative;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;}'
    + '.w167num .g div b{display:block;font-family:' + D + ';font-size:44px;line-height:1;color:' + GOLD + ';}'
    + '.w167num .g div span{display:block;margin-top:4px;font-size:13px;line-height:1.35;color:rgba(255,250,242,.9);}'
    + '.w167num .nt{position:relative;margin:14px 0 0;font-size:11.5px;color:rgba(255,250,242,.65);}'
    + '.w167dyk{display:flex;gap:16px;align-items:flex-start;border-radius:22px;padding:18px 20px;background:rgba(220,165,39,.14);border:1px solid rgba(220,165,39,.35);}'
    + '.w167dyk .yr{flex:0 0 auto;font-family:' + D + ';font-size:34px;line-height:1;color:' + PURPLE + ';}'
    + '.w167dyk .tx{flex:1;min-width:0;}.w167dyk .tx b{display:block;font-size:15px;color:' + GREEN + ';margin-bottom:4px;}.w167dyk .tx p{margin:0;font-size:13.5px;line-height:1.5;color:#3d3c39;}'
    + '.w167dyk .ac{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;}'
    + '.w167lnk{border:0;background:none;padding:0;color:' + GREEN + ';font-weight:700;font-size:13px;text-decoration:underline;cursor:pointer;font-family:inherit;}'
    /* the celebration */
    + '.w167cel{position:absolute;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(16,63,57,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:w167in .25s ease;}'
    + '@keyframes w167in{from{opacity:0;}to{opacity:1;}}'
    + '.w167cel canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}'
    + '.w167cel .cd{position:relative;width:min(440px,calc(100% - 40px));border-radius:28px;background:' + CREAM + ';padding:30px 28px 24px;text-align:center;box-shadow:0 40px 90px -30px rgba(0,0,0,.7);animation:w167pop .45s cubic-bezier(.2,1.4,.4,1);}'
    + '@keyframes w167pop{from{transform:scale(.8);opacity:0;}to{transform:none;opacity:1;}}'
    + '.w167cel .cd .e{width:92px;margin:4px auto 10px;display:block;}'
    + '.w167cel .cd .fl{position:absolute;top:-26px;right:-18px;width:74px;transform:rotate(14deg);}'
    + '.w167cel .cd h3{margin:4px 0 6px;font-family:' + D + ';font-size:40px;line-height:1;text-transform:uppercase;color:' + GREEN + ';}'
    + '.w167cel .cd p{margin:0 0 16px;font-size:14.5px;line-height:1.5;color:#3d3c39;}'
    + '.w167cel .cd .bt{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}'
    /* phones */
    + '@media (max-width:760px){'
    + '.w167hero{flex-direction:column;align-items:flex-start;padding:22px 18px;min-height:0;border-radius:20px;}'
    + '.w167hero:before{background:linear-gradient(180deg,rgba(16,63,57,.62) 0%,rgba(16,63,57,.9) 50%,rgba(16,63,57,.97) 100%);}'
    + '.w167hero .lg{left:18px;top:18px;height:32px;}.w167hero .dd1{width:46px;right:14px;top:14px;}'
    + '.w167hero .tx{padding-top:50px;}.w167hero h1{font-size:40px;}'
    + '.w167hero .rg{position:absolute;right:16px;bottom:16px;width:86px;height:86px;}.w167hero .rg svg{width:86px;height:86px;}.w167hero .rg b{font-size:24px;}.w167hero .rg span{display:none;}'
    + '.w167hero .cta{padding-right:96px;}'
    + '.w167road{margin:18px -18px 4px;padding:36px 0 6px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;}'
    + '.w167road .lane{top:70px;}'
    + '.w167road .stops{grid-template-columns:repeat(5,120px);padding:0 18px;width:max-content;}'
    + '.w167road .lane{left:60px;right:auto;width:560px;}'
    + '.w167stop{scroll-snap-align:center;}.w167stop .pic{width:70px;height:70px;}'
    + '.w167learn{grid-template-columns:1fr;}.w167ban h2{font-size:34px;}.w167ban{min-height:150px;padding:18px;}'
    + '.w167feat{flex-wrap:wrap;}.w167feat .w167btn{width:100%;justify-content:center;}'
    + '.w167num .g div b{font-size:34px;}'
    + '}'
    + '@media (prefers-reduced-motion:reduce){.w167stop.cur .e{animation:none;}.w167cel,.w167cel .cd{animation:none;}.w167bar > i{transition:none;}}';
  if (!document.getElementById('wa167css')) { var st = document.createElement('style'); st.id = 'wa167css'; st.textContent = CSS; document.head.appendChild(st); }
