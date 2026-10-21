
  /* ---------- Home: what matters first, the rest one click away ---------- */
  var KEY_HOME = 'wa262.home';   /* 'all' = Show everything */
  var homeCss = ''
    + '#mypage.w262focus #mpBody{display:flex;flex-direction:column;}'
    + '#mypage.w262focus #mpBody > .mp-head{order:-10;}'
    + '#mypage.w262focus #mpBody > .mp-chips{order:-9;}'
    + '#mypage.w262focus #mpBody > #w74attn{order:-8;}'
    + '#mypage.w262focus #mpBody > .mp-grid{order:-7;}'
    + '#mypage.w262focus #mpBody > #w116home{order:-6;margin-top:12px;}'
    + '#mypage.w262focus #mpBody > #w180card{order:-5;}'
    + '#mypage.w262focus #mpBody > #w112wrap{order:-4;}'
    /* waiting behind Show everything */
    + '#mypage.w262focus #mpBody > .mp-online,#mypage.w262focus #mpBody > #w192feed,#mypage.w262focus #mpBody > #w75card,#mypage.w262focus #mpBody > #w114switch{display:none !important;}'
    + '#mypage.w262focus #mpBody .mp-grid > .w74col:first-child > .mp-sec:nth-child(2){display:none !important;}'   /* Updates for you */
    + '#mypage.w262focus #mpBody .mp-grid .mp-sec:has(#mpHours),#mypage.w262focus #mpBody #w89box{display:none !important;}'   /* time commitments, Slack notifications */
    + '#mypage.w262focus > #w105my{display:none !important;}'   /* time off (Policies stay: they are part of onboarding) */
    + '#w262homebar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:14px 0 2px;padding-top:12px;border-top:1px dashed rgba(16,63,57,.15);font-size:12.5px;color:' + MUTED + ';}'
    + '#w262homebar button{border:1px solid rgba(16,63,57,.25);background:' + CREAM + ';color:' + GREEN + ';border-radius:999px;padding:5px 14px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;}'
    + '#w262homebar button:hover{background:rgba(16,63,57,.06);}'
    + '#w262homebar button:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:2px;}';
  function homeAll() { return readLS(KEY_HOME) === 'all'; }
  function homeBar() {
    var body = document.getElementById('mpBody'), card = body && body.parentNode;
    if (!card) return null;
    var bar = document.getElementById('w262homebar');
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'w262homebar';
      bar.addEventListener('click', function (e) {
        if (!e.target.closest('button')) return;
        writeLS(KEY_HOME, homeAll() ? 'focus' : 'all'); applyHome();
        if (!homeAll()) { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (x) { /* fine */ } }
      });
    }
    if (bar.parentNode !== card) card.appendChild(bar);
    return bar;
  }
  function applyHome() {
    var p = document.getElementById('mypage'); if (!p || !staff()) return;
    var all = homeAll();
    if (p.classList.contains('w262focus') === all) p.classList.toggle('w262focus', !all);
    var bar = homeBar(); if (!bar) return;
    var want = all
      ? '<span>Everything on Home is showing.</span><button type="button" data-w262home="focus" aria-pressed="true">Show less</button>'
      : '<span>Home shows what matters first. In the loop, updates, time off and the rest are one click away.</span><button type="button" data-w262home="all" aria-pressed="false">Show everything on Home</button>';
    if (bar.getAttribute('data-k') !== (all ? 'all' : 'focus')) { bar.setAttribute('data-k', all ? 'all' : 'focus'); bar.innerHTML = want; }
  }
