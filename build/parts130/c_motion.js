/* Shared route entrance, including app pages that reuse one panel. */
(function () {
  var main = document.querySelector('main');
  if (!main || typeof main.animate !== 'function' || typeof window.matchMedia !== 'function') return;
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var route = location.hash;
  var current = null;
  document.documentElement.classList.add('wa-smooth-pages');

  function stop() {
    var previous = current;
    current = null;
    if (previous) previous.cancel();
  }

  function transition() {
    var next = location.hash;
    if (next === route) return;
    route = next;
    if (motion.matches || document.hidden || !document.documentElement.classList.contains('wa-ready')) {
      stop();
      return;
    }
    var running = current && current.playState === 'running';
    var style = running ? getComputedStyle(main) : null;
    var from = style ? { opacity: style.opacity, transform: style.transform } : { opacity: 0.12, transform: 'translateY(7px)' };
    stop();
    var animation = main.animate([from, { opacity: 1, transform: 'translateY(0)' }], {
      duration: 300,
      easing: 'cubic-bezier(.2,.7,.2,1)'
    });
    current = animation;
    function release() { if (current === animation) current = null; }
    animation.onfinish = release;
    animation.oncancel = release;
  }

  window.addEventListener('hashchange', transition, true);
  window.addEventListener('pagehide', stop);
  motion.addEventListener('change', function () { if (motion.matches) stop(); });
})();
