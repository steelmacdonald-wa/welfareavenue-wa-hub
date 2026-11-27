/* wave362: HR centre tabs folded. Recruitment, Onboarding and People stay in view; the rest sit one click away under More. Nothing is removed. */
(function () {
  if (window.__w362) return; window.__w362 = 1;
  var MAIN = { recruitment: 1, onboarding: 1, people: 1 }, open = false;
  try { open = localStorage.getItem('w362open') === '1'; } catch (e) {}
  function css() {
    if (document.getElementById('w362css')) return;
    var s = document.createElement('style'); s.id = 'w362css';
    s.textContent = '.w47tab.w362x{display:none!important}'
      + '.w362m{font:inherit;font-size:13px;border:0;background:transparent;color:#6B6966;cursor:pointer;padding:6px 10px;border-radius:8px;transition:transform 140ms cubic-bezier(.23,1,.32,1),background-color 160ms ease}'
      + '.w362m:active{transform:scale(.97)}'
      + '@media (hover:hover) and (pointer:fine){.w362m:hover{background:#ECEBE3;color:#103F39}}'
      + '@media (prefers-reduced-motion:reduce){.w362m{transition:none}}';
    document.head.appendChild(s);
  }
  function fold() {
    var h = String(location.hash || ''); if (h.indexOf('#hrcentre') !== 0) return;
    var bar = document.querySelector('.w47tabs'); if (!bar) return;
    var tabs = bar.querySelectorAll('.w47tab[data-w47v]'), extra = 0, route = (h.split('/')[1] || '');
    if (!tabs.length) return;
    css();
    for (var i = 0; i < tabs.length; i++) {
      var k = tabs[i].getAttribute('data-w47v'), keep = MAIN[k] || open || tabs[i].classList.contains('on') || k === route;
      if (!MAIN[k]) extra++;
      if (tabs[i].classList.contains('w362x') === !!keep) tabs[i].classList.toggle('w362x', !keep);
    }
    var m = bar.querySelector('.w362m');
    if (!extra) { if (m) bar.removeChild(m); return; }
    if (!m) {
      m = document.createElement('button'); m.type = 'button'; m.className = 'w362m';
      m.addEventListener('click', function () { open = !open; try { localStorage.setItem('w362open', open ? '1' : '0'); } catch (e) {} fold(); });
    }
    if (bar.lastElementChild !== m) bar.appendChild(m);
    var label = open ? 'Less' : 'More (' + extra + ')';
    if (m.textContent !== label) { m.textContent = label; m.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  }
  setInterval(fold, 900);
  window.addEventListener('hashchange', function () { setTimeout(fold, 250); });
  setTimeout(fold, 700);
})();
