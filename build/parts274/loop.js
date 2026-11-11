/* Compact Loop guidance and split closing menu; original actions stay connected. */
(() => {
  'use strict';
  const sheet = () => document.getElementById('w192sheet');
  const wrap = () => sheet()?.querySelector('.wa-loop-info-wrap');
  function showInfo() {
    const host = wrap(), popup = host?.querySelector('[role="tooltip"]');
    if (!popup) return;
    popup.hidden = false; popup.classList.remove('above');
    host.querySelector('button').setAttribute('aria-expanded','true');
    const box = popup.getBoundingClientRect(), button = host.getBoundingClientRect();
    if (box.bottom > innerHeight - 12 && button.top > box.height + 12) popup.classList.add('above');
  }
  function hideInfo() {
    const host = wrap(); if (!host) return;
    host.querySelector('[role="tooltip"]').hidden = true;
    host.querySelector('button').setAttribute('aria-expanded','false');
    delete host.dataset.pinned;
  }
  function closeOptions(focusToggle = false) {
    const root = sheet(), toggle = root?.querySelector('#w192closeoptions'), menu = root?.querySelector('#w192closemenu');
    if (!toggle || !menu) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded','false');
    if (focusToggle) toggle.focus();
  }
  function openOptions(focusItem = false) {
    const root = sheet(), toggle = root?.querySelector('#w192closeoptions'), menu = root?.querySelector('#w192closemenu');
    if (!toggle || !menu || toggle.disabled) return;
    hideInfo();
    menu.hidden = false;
    toggle.setAttribute('aria-expanded','true');
    if (focusItem) menu.querySelector('[role="menuitem"]').focus();
  }
  document.addEventListener('pointerover', event => {
    const host = event.target.closest?.('.wa-loop-info-wrap');
    if (host && event.pointerType !== 'touch' && !host.contains(event.relatedTarget)) showInfo();
  });
  document.addEventListener('pointerout', event => {
    const host = event.target.closest?.('.wa-loop-info-wrap');
    if (host && !host.contains(event.relatedTarget) && !host.dataset.pinned && !host.contains(document.activeElement)) hideInfo();
  });
  document.addEventListener('focusin', event => { if (event.target.closest?.('.wa-loop-info-wrap')) showInfo(); });
  document.addEventListener('focusout', event => {
    const host = event.target.closest?.('.wa-loop-info-wrap');
    if (host && !host.contains(event.relatedTarget) && !host.matches(':hover')) hideInfo();
  });
  document.addEventListener('click', event => {
    if (event.target.closest?.('#w192closeoptions')) {
      const menu = sheet()?.querySelector('#w192closemenu');
      if (menu?.hidden) openOptions(true); else closeOptions(true);
      return;
    }
    if (event.target.closest?.('#w192skip')) closeOptions();
    const summary = event.target.closest?.('#w192draftbox > summary');
    if (summary) {
      event.preventDefault();
      const review = summary.parentElement;
      review.open = !review.open;
      summary.setAttribute('aria-expanded',String(review.open));
      return;
    }
    if (event.target.closest?.('.wa-loop-info')) {
      const host = wrap();
      if (host.dataset.pinned) hideInfo(); else { host.dataset.pinned = '1'; showInfo(); }
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!sheet()) return;
    if (!event.target.closest?.('.wa-loop-info-wrap')) hideInfo();
    if (!event.target.closest?.('.wa-loop-close-group')) closeOptions();
  });
  document.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches?.('#w192draftbox > summary')) {
      event.preventDefault(); event.target.click(); return;
    }
    const root = sheet(), menu = root?.querySelector('#w192closemenu');
    if (event.target.matches?.('#w192closeoptions') && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault(); openOptions(true); return;
    }
    if (event.target.closest?.('#w192closemenu')) {
      if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
        event.preventDefault(); menu.querySelector('[role="menuitem"]').focus(); return;
      }
      if (event.key === 'Tab') closeOptions(true);
    }
    if (event.key !== 'Escape' || !sheet() || document.getElementById('modalBack')?.style.display === 'none') return;
    const popup = wrap()?.querySelector('[role="tooltip"]');
    if (menu && !menu.hidden) closeOptions(true);
    else if (popup && !popup.hidden) hideInfo();
    else sheet().querySelector('#w192dismiss').click();
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  function update() {
    const root = sheet(); if (!root) return;
    const review = root.querySelector('.wa-loop-review');
    review?.querySelector('summary').setAttribute('aria-expanded',String(review.open));
    const toggle = root.querySelector('#w192closeoptions'), close = root.querySelector('#w192close');
    if (toggle && close) toggle.disabled = close.disabled;

  }
  const modal = document.getElementById('modalBox');
  if (modal) new MutationObserver(update).observe(modal,{childList:true,subtree:true,characterData:true});
  update();
})();
