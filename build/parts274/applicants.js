/* Animate the existing applicant disclosure while preserving its original controls. */
(function () {
  const animations = new WeakMap();
  document.addEventListener('click', event => {
    const summary = event.target.closest?.('.wa-app-details > summary');
    if (!summary || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const details = summary.parentElement;
    if (typeof details.animate !== 'function') return;
    event.preventDefault();
    if (animations.has(details)) return;
    const start = details.getBoundingClientRect().height;
    const opening = !details.open;
    if (opening) details.open = true;
    const end = opening ? details.getBoundingClientRect().height : summary.getBoundingClientRect().height;
    details.style.overflow = 'hidden';
    const animation = details.animate([{ height: start + 'px' }, { height: end + 'px' }], {
      duration: 180, easing: 'cubic-bezier(.2,.7,.2,1)'
    });
    animations.set(details, animation);
    animation.onfinish = () => {
      details.open = opening;
      details.style.overflow = '';
      animations.delete(details);
    };
    animation.oncancel = () => {
      details.style.overflow = '';
      animations.delete(details);
    };
  });
})();
