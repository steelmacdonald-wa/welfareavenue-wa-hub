/* Present the existing conversation queue and composer in the lab's layout. */
(function () {
  let scheduled = false;
  function update() {
    scheduled = false;
    if (!/^#volunteering\/phone/.test(location.hash)) return;
    const root = document.getElementById('w256');
    if (!root) return;
    root.classList.add('wa-phone-workspace');
    root.closest('.card')?.classList.add('wa-phone-card');
    const state = window.w256?.state();
    const name = root.querySelector('.th .nm');
    if (!state || !name) return;
    const selected = (state.inbox || []).find(row => row.ph === state.ph);
    let status = name.querySelector('.wa-phone-thread-status');
    if (!status) {
      status = document.createElement('small');
      status.className = 'wa-phone-thread-status';
      name.append(status);
    }
    const text = selected?.wait ? 'Needs reply' : selected ? 'Up to date' : 'New conversation';
    status.classList.toggle('waiting', !!selected?.wait);
    if (status.textContent !== text) status.textContent = text;
  }
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } }
  const section = document.getElementById('volunteering');
  if (section) new MutationObserver(schedule).observe(section, { childList: true, subtree: true });
  window.addEventListener('hashchange', schedule);
  schedule();
})();
