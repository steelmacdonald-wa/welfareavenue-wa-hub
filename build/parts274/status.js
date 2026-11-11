/* Audit prototype: a consistent, keyboard-accessible replacement for native roster status menus. */
(function () {
  'use strict';
  var opened = null, scheduled = false, search = '', searchedAt = 0;
  var tones = { Confirmed: 'confirmed', 'Waiting For Response': 'waiting', TBD: 'to-ask', Unavailable: 'unavailable', Cancelled: 'cancelled' };
  function make(tag, className, text) {
    var el = document.createElement(tag); el.className = className; el.dataset.waEnhancement = '1';
    if (text != null) el.textContent = text;
    return el;
  }
  function setAttribute(el, key, value) { if (el.getAttribute(key) !== String(value)) el.setAttribute(key, value); }
  function tone(value) { return tones[value] || 'none'; }
  function sync(select) {
    var hadFocus = document.activeElement === select;
    var button = select.previousElementSibling;
    if (!button || !button.classList.contains('wa-status-trigger')) {
      button = make('button', 'wa-status-trigger'); button.type = 'button';
      button.id = 'wa-status-' + select.getAttribute('data-vlrstat');
      button.setAttribute('role', 'combobox'); button.setAttribute('aria-haspopup', 'listbox'); button.setAttribute('aria-expanded', 'false');
      var dot = make('span', 'wa-status-dot'); dot.setAttribute('aria-hidden', 'true');
      var chevron = make('span', 'wa-status-chevron'); chevron.setAttribute('aria-hidden', 'true');
      button.append(dot, make('span', 'wa-status-label'), chevron); select.before(button);
    }
    setAttribute(select, 'aria-hidden', 'true'); setAttribute(select, 'tabindex', '-1'); setAttribute(select, 'data-wa-status-ready', 'true');
    var option = select.selectedOptions[0], label = option ? option.textContent : 'No status';
    var text = button.querySelector('.wa-status-label'); if (text.textContent !== label) text.textContent = label;
    setAttribute(button, 'data-status', tone(select.value));
    setAttribute(button, 'aria-label', select.getAttribute('aria-label') || 'Volunteer status');
    setAttribute(button, 'title', label + ' · Change status');
    if (button.disabled !== select.disabled) button.disabled = select.disabled;
    if (hadFocus) button.focus({ preventScroll: true });
    return button;
  }
  function close(focus) {
    if (!opened) return;
    var current = opened; opened = null; search = '';
    current.menu.remove(); current.button.setAttribute('aria-expanded', 'false');
    current.button.removeAttribute('aria-controls'); current.button.removeAttribute('aria-activedescendant');
    if (focus && current.button.isConnected) current.button.focus({ preventScroll: true });
  }
  function position() {
    if (!opened) return;
    var button = opened.button, menu = opened.menu;
    if (!button.isConnected || !button.getClientRects().length) { close(false); return; }
    var anchor = button.getBoundingClientRect();
    if (anchor.bottom < 8 || anchor.top > innerHeight - 8) { close(false); return; }
    var box = menu.getBoundingClientRect(), top = anchor.bottom + 7;
    if (top + box.height > innerHeight - 10 && anchor.top - box.height - 7 >= 10) top = anchor.top - box.height - 7;
    menu.style.left = Math.max(10, Math.min(anchor.left, innerWidth - box.width - 10)) + 'px';
    menu.style.top = Math.max(10, Math.min(top, innerHeight - box.height - 10)) + 'px';
  }
  function activate(index, scroll) {
    if (!opened || !opened.rows.length) return;
    opened.index = Math.max(0, Math.min(index, opened.rows.length - 1));
    opened.rows.forEach(function (row, i) { setAttribute(row, 'data-active', i === opened.index); });
    opened.button.setAttribute('aria-activedescendant', opened.rows[opened.index].id);
    if (scroll) opened.rows[opened.index].scrollIntoView({ block: 'nearest' });
  }
  function open(button) {
    if (opened && opened.button === button) { close(true); return; }
    close(false);
    var select = button.nextElementSibling;
    if (!select || select.disabled) return;
    var menu = make('div', 'wa-status-menu'); menu.id = button.id + '-options';
    var heading = make('div', 'wa-status-menu-heading', 'Change status'); heading.id = menu.id + '-heading';
    var list = make('div', 'wa-status-list'); list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', button.getAttribute('aria-label')); list.id = menu.id + '-list';
    menu.append(heading, list);
    var rows = [], options = Array.from(select.options).filter(function (option) { return !option.disabled; });
    options.forEach(function (option, i) {
      var row = make('div', 'wa-status-option'); row.id = menu.id + '-' + i;
      row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(option.value === select.value));
      row.dataset.status = tone(option.value); row.dataset.value = option.value;
      var dot = make('span', 'wa-status-dot'); dot.setAttribute('aria-hidden', 'true');
      var check = make('span', 'wa-status-check', '✓'); check.setAttribute('aria-hidden', 'true');
      row.append(dot, make('span', 'wa-status-option-label', option.textContent), check); list.append(row); rows.push(row);
    });
    document.body.append(menu);
    opened = { button: button, select: select, menu: menu, rows: rows, index: 0 };
    button.setAttribute('aria-expanded', 'true'); button.setAttribute('aria-controls', list.id);
    activate(Math.max(0, options.findIndex(function (option) { return option.value === select.value; })), false);
    position(); button.focus({ preventScroll: true });
  }
  function choose(row) {
    if (!opened) return;
    var select = opened.select, value = row.dataset.value, changed = select.value !== value;
    select.value = value; sync(select); close(true);
    // The existing save, attribution and team-count handlers remain the single write path.
    if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function enhance() {
    scheduled = false;
    if (opened && !opened.select.isConnected) close(false);
    document.querySelectorAll('#w191team .pc .sel2 > select[data-vlrstat]').forEach(sync);
  }
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(enhance); } }
  document.addEventListener('click', function (e) {
    var target = e.target.closest ? e.target : e.target.parentElement;
    var button = target.closest('.wa-status-trigger');
    if (button) { e.preventDefault(); open(button); return; }
    var row = target.closest('.wa-status-option');
    if (row && opened && opened.menu.contains(row)) { e.preventDefault(); choose(row); return; }
    if (opened && !opened.menu.contains(target)) close(false);
  });
  document.addEventListener('pointerdown', function (e) {
    if (opened && opened.menu.contains(e.target)) e.preventDefault();
  });
  document.addEventListener('pointermove', function (e) {
    var row = e.target.closest && e.target.closest('.wa-status-option');
    if (opened && row && opened.menu.contains(row)) activate(opened.rows.indexOf(row), false);
  });
  document.addEventListener('keydown', function (e) {
    var button = e.target.closest && e.target.closest('.wa-status-trigger'); if (!button || button.disabled) return;
    var keys = ['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!opened || opened.button !== button) {
      if (keys.includes(e.key)) {
        e.preventDefault(); e.stopImmediatePropagation(); open(button);
        if (e.key === 'Home') activate(0, true);
        if (e.key === 'End') activate(opened.rows.length - 1, true);
      }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(true); return; }
    if (e.key === 'Tab') { close(false); return; }
    if (keys.includes(e.key)) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.key === 'Enter' || e.key === ' ') choose(opened.rows[opened.index]);
      else activate(e.key === 'Home' ? 0 : e.key === 'End' ? opened.rows.length - 1 : opened.index + (e.key === 'ArrowDown' ? 1 : -1), true);
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault(); e.stopImmediatePropagation(); var now = Date.now(); search = now - searchedAt > 650 ? e.key.toLowerCase() : search + e.key.toLowerCase(); searchedAt = now;
      var start = search.length === 1 ? opened.index + 1 : opened.index;
      for (var i = 0; i < opened.rows.length; i++) {
        var at = (start + i) % opened.rows.length;
        if (opened.rows[at].querySelector('.wa-status-option-label').textContent.toLowerCase().startsWith(search)) { activate(at, true); break; }
      }
    }
  }, true);
  document.addEventListener('focusin', function (e) {
    if (opened && e.target !== opened.button && !opened.menu.contains(e.target)) close(false);
  });
  document.addEventListener('change', function (e) {
    if (e.target.matches('#w191team [data-vlrstat]')) sync(e.target);
  }, true);
  document.addEventListener('scroll', position, true);
  window.addEventListener('resize', position);
  window.addEventListener('hashchange', function () { close(false); });
  function boot() {
    var section = document.getElementById('volunteering'); if (!section) return;
    new MutationObserver(function (records) {
      if (records.some(function (record) { return !record.target.closest || !record.target.closest('[data-wa-enhancement]'); })) schedule();
    }).observe(section, { childList: true, subtree: true });
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
