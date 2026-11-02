
  /* ---------- the how-to films: adding the Hub to a phone ----------
     Every frame is a function of time (seek): nothing here carries state between frames, so a film can be paused, stepped
     or looped from anywhere. Silent on purpose: people watch these on a phone, often in a meeting.
     Steps: Apple "Turn a website into an app in Safari on iPhone" and "Bookmark a website in Safari on iPhone"; Google Chrome
     Help "Use web apps" (Android). The phone is an illustration, so the film says a phone may look a little different. */
  var HW = {
    iphone: {
      dur: 18, title: 'Add the Hub to your iPhone', where: 'In Safari, at hub.welfareavenue.com',
      steps: [[2.4, 'Tap ··· next to the address'], [5.2, 'Tap Share'], [7, 'Scroll down, tap Add to Home Screen'], [10.4, 'Keep Open as Web App on, tap Add'], [13.8, 'Open the Hub from your new icon']],
      plain: ['In Safari, open hub.welfareavenue.com.', 'Tap the ··· next to the address, then Share. If you see the Share button at the bottom or top of Safari, tap it directly.', 'Scroll down and tap Add to Home Screen. If it is not there, tap Edit Actions at the bottom of the list and add it.', 'Keep Open as Web App on, then tap Add.', 'Open the Hub from its new icon, then turn on notifications there.']
    },
    android: {
      dur: 14.5, title: 'Add the Hub to your Android', where: 'In Chrome, at hub.welfareavenue.com',
      steps: [[2.4, 'Tap ⋮ at the top right'], [5, 'Tap Add to home screen'], [7.6, 'Tap Install'], [10, 'Open the Hub from your new icon']],
      plain: ['In Chrome, open hub.welfareavenue.com.', 'Tap the ⋮ at the top right.', 'Tap Add to home screen, then Install. If Chrome offers Install on its own, tap that instead.', 'Open the Hub from its new icon, then turn on notifications there.']
    }
  };
  var hwCss = ''
    + '.w272hw{--g:#103F39;--c:#FFFAF2;--a:#DCA527;--i:#1F201E;width:100%;max-width:330px;margin:0 auto;font-family:' + BODY + ';color:var(--i);}'
    + '.w272hw .cap{display:flex;align-items:center;gap:10px;min-height:66px;margin-bottom:10px;}'
    + '.w272hw .n{flex:none;width:30px;height:30px;border-radius:50%;background:var(--g);color:var(--c);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;}'
    + '.w272hw .n[hidden]{display:none;}'
    + '.w272hw .tx{font-size:18px;line-height:1.22;font-weight:500;color:var(--g);}'
    + '.w272hw .tx.hook{font-family:' + HEAD + ';font-weight:500;font-size:30px;line-height:1.02;text-transform:uppercase;}'
    + '.w272hw .ph{position:relative;width:248px;height:440px;margin:0 auto;border-radius:34px;background:var(--i);padding:7px;box-shadow:0 12px 34px rgba(16,24,22,.22);}'
    + '.w272hw .sc{position:relative;width:100%;height:100%;border-radius:27px;overflow:hidden;background:var(--c);font-size:13px;}'
    + '.w272hw .sc>*{position:absolute;}'
    + '.w272hw .pg{inset:0;}'
    + '.w272hw .pg .hd{position:absolute;left:0;right:0;height:110px;background:var(--g);color:var(--c);padding:14px;}'
    + '.w272hw .pg .hd b{display:block;font:500 25px/1 ' + HEAD + ';text-transform:uppercase;margin-top:6px;}'
    + '.w272hw .pg i{position:absolute;left:14px;right:14px;height:44px;border-radius:12px;background:rgba(16,63,57,.08);}'
    + '.w272hw .ad{left:8px;right:8px;height:42px;border-radius:21px;background:var(--c);box-shadow:0 2px 12px rgba(16,24,22,.2);display:flex;align-items:center;padding:0 6px 0 14px;font-size:12px;color:var(--i);white-space:nowrap;overflow:hidden;}'
    + '.w272hw .ad span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;}'
    + '.w272hw .dots{flex:none;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700;color:var(--g);}'
    + '.w272hw .lst{background:var(--c);border-radius:16px;box-shadow:0 8px 28px rgba(16,24,22,.28);overflow:hidden;}'
    + '.w272hw .lst div{padding:11px 14px;border-top:1px solid rgba(16,63,57,.1);font-size:13.5px;color:var(--i);white-space:nowrap;}'
    + '.w272hw .lst div:first-child{border-top:0;}'
    + '.w272hw .lst .hit{font-weight:700;color:var(--g);}'
    + '.w272hw .sheet{left:0;right:0;bottom:0;height:300px;background:var(--c);border-radius:18px 18px 0 0;box-shadow:0 -6px 24px rgba(16,24,22,.22);overflow:hidden;}'
    + '.w272hw .sheet .in{position:absolute;left:10px;right:10px;top:12px;}'
    + '.w272hw .sheet .lst{box-shadow:none;margin-bottom:8px;}'
    + '.w272hw .dlg{left:10px;right:10px;background:var(--c);border-radius:18px;box-shadow:0 12px 34px rgba(16,24,22,.32);padding:14px;}'
    + '.w272hw .dlg .top{display:flex;gap:10px;align-items:center;font-weight:500;font-size:14px;}'
    + '.w272hw .dlg .row{display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid rgba(16,63,57,.1);font-size:13px;}'
    + '.w272hw .sw{width:34px;height:20px;border-radius:10px;background:var(--g);position:relative;}'
    + '.w272hw .sw:after{content:"";position:absolute;right:2px;top:2px;width:16px;height:16px;border-radius:50%;background:var(--c);}'
    + '.w272hw .dlg .btn{margin-top:12px;height:38px;border-radius:12px;background:var(--a);color:var(--g);display:flex;align-items:center;justify-content:center;font:600 16px/1 ' + HEAD + ';letter-spacing:.5px;text-transform:uppercase;}'
    + '.w272hw .ic{width:42px;height:42px;border-radius:10px;background:var(--g);flex:none;display:grid;gap:4px;align-content:center;justify-items:start;padding-left:12px;box-sizing:border-box;}'
    + '.w272hw .ic i{display:block;width:17px;height:4px;border-radius:1px;background:var(--c);}'
    + '.w272hw .ic i:first-child,.w272hw .ic i:last-child{width:20px;}'
    + '.w272hw .home{inset:0;background:var(--g);}'
    + '.w272hw .home .bl{position:absolute;width:42px;height:42px;border-radius:10px;background:rgba(255,250,242,.14);}'
    + '.w272hw .home .app{position:absolute;display:grid;justify-items:center;gap:4px;width:66px;color:var(--c);font-size:11px;font-weight:500;}'
    + '.w272hw .home .app .ic{background:var(--c);}'
    + '.w272hw .home .app .ic i{background:var(--g);}'
    + '.w272hw .tap{width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:3px solid var(--a);background:rgba(220,165,39,.28);pointer-events:none;}'
    + '.w272hw .foot{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:12px;}'
    + '.w272hw .foot button{border:0;background:rgba(16,63,57,.1);color:var(--g);border-radius:999px;min-width:34px;height:34px;padding:0 10px;font:600 13px ' + BODY + ';cursor:pointer;}'
    + '.w272hw .foot button.on{background:var(--g);color:var(--c);}'
    + '.w272hw .foot button:focus-visible{outline:2px solid var(--a);outline-offset:2px;}'
    + '.w272hw .note{margin:8px 0 0;font-size:12px;color:rgba(31,32,30,.7);text-align:center;}'
    + '.w272hw ol{margin:12px 0 0;padding-left:20px;font-size:14px;line-height:1.45;}'
    + '.w272hw ol li{margin:0 0 5px;}';
  function hwClamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function hwOut(x) { x = hwClamp(x); return 1 - Math.pow(1 - x, 3); }
  function hwIn(x) { x = hwClamp(x); return x * x * x; }
  /* a surface that arrives at a, leaves at b: 0 hidden, 1 resting */
  function hwVis(t, a, b, dIn, dOut) { dIn = dIn || 0.3; dOut = dOut || 0.16; return t < a ? 0 : (b != null && t >= b ? 1 - hwIn((t - b) / dOut) : hwOut((t - a) / dIn)); }
  /* a spring with a little overshoot, once: the icon landing is the film's one hero moment */
  function hwSpring(x) { if (x <= 0) return 0; return 1 - Math.exp(-7 * x) * Math.cos(9 * x); }
  function hwBuild(host, kind) {
    var F = HW[kind], ios = kind === 'iphone';
    var blanks = ''; for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) { if (r === 1 && c === 1) continue; blanks += '<span class="bl" style="left:' + (12 + c * 55) + 'px;top:' + (34 + r * 74) + 'px"></span>'; }
    var icon = '<span class="ic"><i></i><i></i><i></i></span>';
    host.classList.add('w272hw');
    host.innerHTML = '<div class="cap"><span class="n" hidden></span><div class="tx hook"></div></div>'
      + '<div class="ph" aria-hidden="true"><div class="sc">'
      + '<div class="pg"><div class="hd" style="top:' + (ios ? 0 : 56) + 'px"><small>Welfare Avenue Hub</small><b>Good morning</b></div>'
      + [130, 186, 242, 298].map(function (y) { return '<i style="top:' + (y + (ios ? 0 : 56)) + 'px"></i>'; }).join('') + '</div>'
      + '<div class="ad" style="' + (ios ? 'bottom:10px' : 'top:8px') + '"><span>hub.welfareavenue.com</span><b class="dots">' + (ios ? '···' : '⋮') + '</b></div>'
      + '<div class="lst menu" style="right:10px;width:176px;' + (ios ? 'bottom:60px' : 'top:56px') + '">' + (ios
        ? '<div>Copy</div><div class="hit">Share</div><div>Add Bookmark</div><div>Find on Page</div>'
        : '<div>New tab</div><div>Bookmarks</div><div>Share</div><div class="hit">Add to home screen</div><div>Settings</div>') + '</div>'
      + (ios ? '<div class="sheet"><div class="in"><div class="lst"><div>Copy</div><div>Add to Reading List</div><div>Add Bookmark</div><div>Add to Favourites</div></div><div class="lst"><div>Find on Page</div><div class="hit">Add to Home Screen</div><div>Markup</div></div></div></div>' : '')
      + '<div class="dlg" style="top:' + (ios ? 96 : 130) + 'px"><div class="top">' + icon + '<span>' + (ios ? 'WA Hub' : 'Install app') + '</span></div>'
      + (ios ? '<div class="row"><span>Open as Web App</span><span class="sw"></span></div>' : '<div class="row"><span>WA Hub<br>hub.welfareavenue.com</span></div>')
      + '<div class="btn">' + (ios ? 'Add' : 'Install') + '</div></div>'
      + '<div class="home">' + blanks + '<div class="app" style="left:55px;top:108px">' + icon + '<span>WA Hub</span></div></div>'
      + '<div class="tap"></div></div></div>'
      + '<div class="foot"><button type="button" data-hw="play">Pause</button>' + F.steps.map(function (s, i) { return '<button type="button" data-hw="' + i + '" aria-label="Step ' + (i + 1) + '">' + (i + 1) + '</button>'; }).join('') + '</div>'
      + '<p class="note">An illustration: your phone may look a little different.</p>'
      + '<ol>' + F.plain.map(function (p) { return '<li>' + E(p) + '</li>'; }).join('') + '</ol>';
    var q = function (s) { return host.querySelector(s); };
    var el = { n: q('.n'), tx: q('.tx'), ad: q('.ad'), menu: q('.menu'), sheet: q('.sheet'), inn: q('.sheet .in'), dlg: q('.dlg'), home: q('.home'), app: q('.home .app'), tap: q('.tap'), btns: host.querySelectorAll('.foot [data-hw]') };
    /* where and when the finger lands: x, y on the 234 by 426 screen */
    var TAPS = ios
      ? [[4.2, 205, 395], [6.4, 150, 236], [9.6, 90, 279], [12.9, 117, 191]]
      : [[4.2, 212, 29], [7, 140, 164], [9, 117, 231]];
    function seek(t) {
      /* the caption: the promise first, then one step at a time */
      var cur = -1; F.steps.forEach(function (s, i) { if (t >= s[0]) cur = i; });
      var txt = cur < 0 ? F.title : F.steps[cur][1];
      if (el.tx.textContent !== txt) { el.tx.textContent = txt; el.tx.classList.toggle('hook', cur < 0); }
      el.n.hidden = cur < 0; if (cur >= 0) el.n.textContent = String(cur + 1);
      el.btns.forEach(function (b) { var k = b.getAttribute('data-hw'); if (k !== 'play') b.classList.toggle('on', Number(k) === cur); });
      var menu, sheet = 0, dlg, home, list = 0, iconAt;
      if (ios) {
        menu = hwVis(t, 4.35, 6.55); sheet = hwVis(t, 6.55, 9.75, 0.34); list = hwOut((t - 7.7) / 0.9); dlg = hwVis(t, 9.75, 13.05); home = t >= 13.05 ? hwOut((t - 13.05) / 0.26) : 0; iconAt = 13.35;
      } else {
        menu = hwVis(t, 4.35, 7.15); dlg = hwVis(t, 7.15, 9.15); home = t >= 9.15 ? hwOut((t - 9.15) / 0.26) : 0; iconAt = 9.45;
      }
      el.menu.style.opacity = menu; el.menu.style.transformOrigin = ios ? 'bottom right' : 'top right'; el.menu.style.transform = 'scale(' + (0.92 + 0.08 * menu) + ')';
      if (el.sheet) { el.sheet.style.transform = 'translateY(' + (100 - 100 * sheet) + '%)'; el.sheet.style.visibility = sheet > 0 ? 'visible' : 'hidden'; el.inn.style.transform = 'translateY(' + (-48 * list) + 'px)'; }
      el.dlg.style.opacity = dlg; el.dlg.style.transform = 'translateY(' + (10 - 10 * dlg) + 'px) scale(' + (0.97 + 0.03 * dlg) + ')';
      el.home.style.opacity = home;
      var sp = hwSpring((t - iconAt) / 0.7); el.app.style.transform = 'scale(' + (t < iconAt ? 0.6 : 0.6 + 0.4 * sp) + ')'; el.app.style.opacity = t < iconAt ? 0 : hwClamp((t - iconAt) / 0.14);
      /* the finger: arrives, presses, lifts */
      var tp = null; TAPS.forEach(function (x) { if (t >= x[0] - 0.42 && t < x[0] + 0.24) tp = x; });
      if (tp) {
        var u = t - tp[0], s = u < -0.12 ? 1.25 - 0.25 * hwOut((u + 0.42) / 0.3) : u < 0.04 ? 1 - 0.28 * hwOut((u + 0.12) / 0.16) : 0.72 + 0.28 * hwOut((u - 0.04) / 0.2);
        el.tap.style.left = tp[1] + 'px'; el.tap.style.top = tp[2] + 'px'; el.tap.style.transform = 'scale(' + s + ')';
        el.tap.style.opacity = u < -0.2 ? hwClamp((u + 0.42) / 0.2) : u > 0.08 ? 1 - hwClamp((u - 0.08) / 0.16) : 1;
      } else el.tap.style.opacity = 0;
    }
    var P = { t: 0, on: false, raf: 0, last: 0, seen: true };
    function frame(now) {
      if (!P.on) return;
      if (host.isConnected === false) { stop(); return; }
      if (P.seen) { P.t += Math.min(0.1, (now - P.last) / 1000); if (P.t >= F.dur) P.t = 0; seek(P.t); }
      P.last = now; P.raf = requestAnimationFrame(frame);
    }
    function stop() { P.on = false; cancelAnimationFrame(P.raf); var b = host.querySelector('[data-hw="play"]'); if (b) b.textContent = 'Play'; }
    function play() { if (P.on) return; P.on = true; P.last = performance.now(); var b = host.querySelector('[data-hw="play"]'); if (b) b.textContent = 'Pause'; P.raf = requestAnimationFrame(frame); }
    host.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-hw]'); if (!b) return;
      var k = b.getAttribute('data-hw');
      if (k === 'play') { if (P.on) stop(); else play(); return; }
      stop(); P.t = F.steps[Number(k)][0] + 0.02; seek(ios && Number(k) === F.steps.length - 1 ? 16 : P.t); if (ios && Number(k) === F.steps.length - 1) P.t = 16; else if (!ios && Number(k) === F.steps.length - 1) { P.t = 12; seek(12); }
    });
    try { new IntersectionObserver(function (es) { P.seen = es[0].isIntersecting; }).observe(host); } catch (e) { /* plays anyway */ }
    seek(0);
    /* someone who asked their device for less motion gets the steps and starts it themselves */
    var calm = false; try { calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* fine */ }
    if (calm) stop(); else play();
    return { seek: seek, DUR: F.dur, play: play, stop: stop };
  }
  function hwStyle() {
    if (document.getElementById('w272hwcss')) return;
    var s = document.createElement('style'); s.id = 'w272hwcss'; s.textContent = hwCss; document.head.appendChild(s);
  }
  window.w272howto = function (host, kind) { hwStyle(); return hwBuild(host, kind); };
