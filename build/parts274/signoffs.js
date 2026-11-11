/* Give the existing sign-off requests a full-height review area. */
(function () {
  let scheduled = false;
  function update() {
    scheduled = false;
    if (!/^#volunteering\/signoffs/.test(location.hash)) return;
    const root = document.getElementById('w195');
    if (!root) return;
    root.classList.add('wa-signoffs-workspace');
    root.closest('.card')?.classList.add('wa-signoffs-card');
  }
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } }
  const section = document.getElementById('volunteering');
  if (section) new MutationObserver(schedule).observe(section, { childList: true, subtree: true });
  window.addEventListener('hashchange', schedule);
  schedule();
})();
