/* Local audit experiment. Enhances the original serving controls without replacing their data handlers. */
(function () {
  'use strict';
  var states = new Map(), active = null, queued = false, pendingFocus = null;
  var roleStyle = {
    team_leader: ['#286c5b', '#e8f0e9', 'M8 20v-2a4 4 0 0 1 8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],
    cook: ['#a66b17', '#faf0d9', 'M8 14H6a4 4 0 0 1 0-8 4 4 0 0 1 7-2 4 4 0 0 1 5 6h-2v9H8zM8 16h8'],
    driver: ['#336d9f', '#e8f0f8', 'm5 9 2-5h10l2 5M3 10h18v8H3zM6 18v2m12-2v2M6 13h1m10 0h1'],
    server: ['#aa593d', '#f9eadd', 'M3 15h18M5 13a7 7 0 0 1 14 0M12 6V3M7 19h10'],
    dishwasher: ['#298178', '#e4f1ed', 'M5 4v8a7 7 0 0 0 14 0V4M8 4v8a4 4 0 0 0 8 0V4M4 21h16'],
    photographer: ['#83528e', '#f2e9f4', 'M3 7h5l2-3h4l2 3h5v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],
    videographer: ['#6d5aad', '#eeebfa', 'M3 6h12v13H3zM15 10l6-3v11l-6-3'],
    community_debrief: ['#4f7c3c', '#ecf2e4', 'M21 11a8 8 0 0 1-8 8H9l-6 3v-7a8 8 0 1 1 18-4M7 10h10M7 14h6']
  };
  function node(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    el.dataset.waEnhancement = '1';
    return el;
  }
  function setText(el, text) { if (el && el.textContent !== text) el.textContent = text; }
  function attr(el, name, value) { if (el.getAttribute(name) !== String(value)) el.setAttribute(name, value); }
  function state() {
    var key = location.hash;
    if (!states.has(key)) states.set(key, { open: {}, folded: {}, query: '', awaiting: false });
    return states.get(key);
  }
  function icon(path) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(svg.namespaceURI, 'path'); p.setAttribute('d', path); svg.appendChild(p);
    return svg;
  }
  function paintRole(el, role) {
    var c = roleStyle[role] || roleStyle.team_leader;
    if (el.style.getPropertyValue('--role-ink') !== c[0]) el.style.setProperty('--role-ink', c[0]);
    if (el.style.getPropertyValue('--role-paper') !== c[1]) el.style.setProperty('--role-paper', c[1]);
  }
  function originals(card) { return Array.from(card.querySelectorAll(':scope > .w171tag')); }
  function isConfirmation(text) { return /^(?:✓|Confirmed by|Replied YES|Said yes)/i.test(text); }
  function isRecipe(text) { return /^Cooking:/i.test(text); }
  function awaiting(card) {
    var s = card.querySelector('[data-vlrstat]');
    return s && !/^(Confirmed|Unavailable|Cancelled)$/i.test(s.value) && !card.classList.contains('gone');
  }
  function decorateCard(card) {
    var name = card.querySelector(':scope > b'); if (!name) return;
    var btn = card.querySelector(':scope > .wa-contact-trigger');
    if (!btn) {
      btn = node('button', 'wa-contact-trigger', 'Details'); btn.type = 'button';
      btn.prepend(icon('M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'));
      btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false');
      card.appendChild(btn);
    }
    attr(btn, 'aria-label', 'Details for ' + name.textContent);
    var tags = originals(card), confirmation = tags.find(function (t) { return isConfirmation(t.textContent); });
    var conf = card.querySelector(':scope > .wa-confirmation');
    if (!conf) { conf = node('span', 'wa-confirmation'); card.appendChild(conf); }
    var status = card.querySelector('[data-vlrstat]');
    var text = confirmation ? confirmation.textContent : status && status.value === 'Confirmed' ? 'Confirmation source not recorded' : awaiting(card) ? 'Not confirmed yet' : 'Not attending';
    setText(conf, text); attr(conf, 'data-confirmed', !!confirmation);
    var recipe = tags.find(function (t) { return isRecipe(t.textContent); });
    var cook = card.closest('[data-w119role]').getAttribute('data-w119role') === 'cook';
    var recipeEl = card.querySelector(':scope > .wa-recipe');
    if (cook) {
      if (!recipeEl) { recipeEl = node('span', 'wa-recipe'); card.appendChild(recipeEl); }
      setText(recipeEl, recipe ? recipe.textContent : 'Recipe not assigned');
    } else if (recipeEl) recipeEl.remove();
  }
  function closeContact(focus) {
    if (!active) return;
    var old = active; active = null;
    old.panel.hidden = true; old.trigger.setAttribute('aria-expanded', 'false');
    if (focus && old.trigger.isConnected) old.trigger.focus({ preventScroll: true });
  }
  function positionContact() {
    if (!active) return;
    if (!active.trigger.isConnected || !active.trigger.getClientRects().length) { closeContact(false); return; }
    var a = active.trigger.getBoundingClientRect(), p = active.panel;
    if (a.bottom < 0 || a.top > innerHeight) { closeContact(false); return; }
    var box = p.getBoundingClientRect(), gap = 10;
    var left = Math.max(12, Math.min(a.right - box.width, innerWidth - box.width - 12));
    var top = a.bottom + gap;
    if (top + box.height > innerHeight - 12 && a.top - box.height - gap >= 12) top = a.top - box.height - gap;
    top = Math.max(12, Math.min(top, innerHeight - box.height - 12));
    p.style.left = left + 'px'; p.style.top = top + 'px';
  }
  function syncContactExtras(card, panel) {
    var extras = panel.querySelector('.wa-contact-extra');
    var tags = originals(card).filter(function (t) { return !isConfirmation(t.textContent) && !isRecipe(t.textContent); });
    var signature = JSON.stringify(tags.map(function (t) { return [t.textContent, t.getAttribute('data-w174drv')]; }));
    if (extras.dataset.content === signature) return;
    var hadFocus = extras.contains(document.activeElement);
    extras.replaceChildren();
    tags.forEach(function (t) {
      var driver = t.getAttribute('data-w174drv');
      var line = node(driver ? 'button' : 'div', driver ? 'wa-detail-action' : 'wa-detail-line', driver ? 'Driver assignment: ' + t.textContent + ' · Change' : t.textContent);
      if (driver) { line.type = 'button'; line.setAttribute('data-w174drv', driver); }
      extras.append(line);
    });
    extras.dataset.content = signature;
    if (hadFocus && extras.querySelector('button')) extras.querySelector('button').focus({ preventScroll: true });
  }
  function openContact(trigger) {
    if (active && active.trigger === trigger) { closeContact(true); return; }
    closeContact(false);
    var card = trigger.closest('[data-w119card]'), name = card.querySelector(':scope > b').textContent;
    var panel = card.querySelector(':scope > .wa-contact-panel');
    if (!panel) {
      panel = node('div', 'wa-contact-panel'); panel.id = 'wa-contact-' + card.getAttribute('data-w119card');
      panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false');
      panel.setAttribute('aria-labelledby', panel.id + '-name'); panel.hidden = true;
      var head = node('div', 'wa-contact-head'), who = node('div', 'wa-contact-who');
      who.append(node('span', 'wa-contact-kicker', 'VOLUNTEER DETAILS'));
      var title = node('h3', '', name); title.id = panel.id + '-name'; who.append(title); head.append(who);
      var close = node('button', 'wa-contact-close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close volunteer details'); head.append(close); panel.append(head);
      var info = node('div', 'wa-contact-info');
      Array.from(card.querySelectorAll(':scope > .c, :scope > .flag')).forEach(function (el) {
        var line = el.cloneNode(true); line.className = 'wa-detail-line'; line.removeAttribute('title'); info.append(line);
      });
      if (!info.children.length) info.append(node('p', 'wa-detail-line', 'No contact details recorded.'));
      panel.append(info);
      var extra = node('div', 'wa-contact-extra'); panel.append(extra);
      var move = card.querySelector('[data-w119mv]');
      if (move) {
        var label = node('label', 'wa-contact-move', 'Move to another role');
        move.options[0].textContent = 'Choose a role…'; label.append(move); panel.append(label);
      }
      var remove = card.querySelector(':scope > [data-w119rm]');
      if (remove) { remove.textContent = 'Remove from this serving'; panel.append(remove); }
      card.append(panel); trigger.setAttribute('aria-controls', panel.id);
    }
    syncContactExtras(card, panel);
    panel.hidden = false; trigger.setAttribute('aria-expanded', 'true');
    active = { panel: panel, trigger: trigger }; positionContact();
    panel.querySelector('.wa-contact-close').focus({ preventScroll: true });
  }
  function decorateFlow(root) {
    var bar = root.querySelector('.w191bar'); if (!bar) return;
    attr(bar, 'role', 'group'); attr(bar, 'aria-label', 'Serving workflow: select a stage to open its checklist');
    if (!bar.previousElementSibling || !bar.previousElementSibling.classList.contains('wa-flow-label')) {
      var label = node('div', 'wa-flow-label');
      label.append(node('b', '', 'SERVING WORKFLOW'), node('span', '', 'Select a stage to jump to its checklist'));
      bar.before(label);
    }
    Array.from(bar.querySelectorAll('[data-w191stage]')).forEach(function (button, i) {
      var marker = button.querySelector('.wa-flow-number');
      if (!marker) { marker = node('em', 'wa-flow-number'); button.prepend(marker); }
      setText(marker, button.classList.contains('done') ? '✓' : String(i + 1));
      var now = button.classList.contains('now');
      if (now) attr(button, 'aria-current', 'step'); else button.removeAttribute('aria-current');
      if (now) setText(button.querySelector('span'), 'Current stage');
      var title = button.querySelector('b').textContent, sub = button.querySelector('span').textContent;
      attr(button, 'aria-label', title + ': ' + sub + (now ? ', current stage' : '') + '. Open checklist');
    });
  }
  function decorateShortages(team) {
    var line = team.querySelector(':scope > .b > .w191own > .w191line'); if (!line) return;
    var chips = Array.from(line.querySelectorAll('[data-w119bench]')), shown = 0;
    chips.forEach(function (chip) {
      if (!chip.classList.contains('short')) { chip.hidden = true; return; }
      chip.hidden = false; shown++;
      var role = chip.getAttribute('data-w119bench'); paintRole(chip, role);
      if (chip.dataset.waGap) return;
      var txt = chip.textContent, m = txt.match(/(\d+)\/(\d+)\s*$/); if (!m) return;
      var label = txt.slice(0, m.index).trim(), open = Number(m[2]) - Number(m[1]);
      chip.replaceChildren(node('span', '', label), node('b', '', open + ' open'), node('small', '', m[1] + '/' + m[2]));
      chip.dataset.waGap = '1';
      attr(chip, 'aria-label', label + ': ' + open + ' open ' + (open === 1 ? 'place' : 'places') + '. Add volunteers');
    });
    var label = line.querySelector('.wa-gap-label');
    if (!label) { label = node('span', 'wa-gap-label'); line.prepend(label); }
    setText(label, shown ? 'NEEDS PEOPLE' : '✓ Every role filled');
  }
  function toolbar(team) {
    var tools = team.querySelector('.wa-roster-tools'), s = state();
    if (!tools) {
      tools = node('div', 'wa-roster-tools');
      var search = node('label', 'wa-roster-search');
      search.append(icon('m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0'));
      var input = node('input'); input.type = 'search'; input.placeholder = 'Find a volunteer or recipe'; input.setAttribute('aria-label', 'Search this roster'); input.value = s.query; search.append(input); tools.append(search);
      var filter = node('button', 'wa-awaiting-filter'); filter.type = 'button'; tools.append(filter);
      var expand = node('button', 'wa-expand-roles', 'Expand all'); expand.type = 'button'; tools.append(expand);
      var results = node('span', 'wa-roster-results'); results.setAttribute('role', 'status'); results.setAttribute('aria-live', 'polite'); tools.append(results);
      var empty = node('div', 'wa-roster-no-results'); empty.hidden = true;
      empty.append(node('b', '', 'No volunteers match these filters.'));
      var clear = node('button', 'wa-clear-roster', 'Clear filters'); clear.type = 'button'; empty.append(clear);
      var board = team.querySelector('.board'); if (board) { board.before(tools, empty); }
    }
    return tools;
  }
  function decorateRoles(team) {
    var s = state(), tools = toolbar(team), query = s.query.trim().toLowerCase(), total = 0, waiting = 0, matches = 0, visibleRoles = [];
    team.querySelectorAll('.board > .rc[data-w119role]').forEach(function (role) {
      var key = role.getAttribute('data-w119role'); paintRole(role, key);
      var h = role.querySelector(':scope > .h'), label = h.querySelector(':scope > b'), count = h.querySelector(':scope > .n');
      if (!label || !count) return;
      var toggle = h.querySelector('.wa-role-toggle');
      if (!toggle) {
        toggle = node('button', 'wa-role-toggle'); toggle.type = 'button';
        var badge = node('span', 'wa-role-icon'); badge.append(icon((roleStyle[key] || roleStyle.team_leader)[2]));
        var title = node('span', 'wa-role-title'); title.append(node('b', '', label.textContent), node('small', 'wa-role-meta'));
        toggle.append(badge, title, node('span', 'wa-role-count'), node('span', 'wa-role-chevron', '⌄')); h.prepend(toggle);
      }
      var cards = Array.from(role.querySelectorAll(':scope > [data-w119card]')), roleMatches = 0;
      cards.forEach(function (card) {
        decorateCard(card); total++; if (awaiting(card)) waiting++;
        var hay = [card.querySelector(':scope > b').textContent, label.textContent, card.querySelector('.wa-recipe')?.textContent || ''].join(' ').toLowerCase();
        var match = (!query || query.split(/\s+/).every(function (word) { return hay.includes(word); })) && (!s.awaiting || awaiting(card));
        card.hidden = !match; if (match) roleMatches++;
      });
      var filtered = !!query || s.awaiting;
      role.hidden = filtered && !roleMatches; matches += roleMatches;
      var isOpen = filtered ? !!roleMatches && !s.folded[key] : !!s.open[key];
      attr(role, 'data-wa-open', isOpen);
      attr(toggle, 'aria-expanded', isOpen);
      // Cards remain direct children for the original status, move and drag handlers.
      var bodyId = 'wa-role-' + key;
      attr(role, 'id', bodyId);
      setText(toggle.querySelector('.wa-role-count'), count.textContent);
      var sub = role.querySelector(':scope > .sub');
      setText(toggle.querySelector('.wa-role-meta'), (sub ? sub.textContent : 'No volunteers yet') + (filtered ? ' · ' + roleMatches + ' match' + (roleMatches === 1 ? '' : 'es') : ''));
      attr(toggle, 'aria-label', label.textContent + ', ' + count.textContent + ' places filled. ' + (sub ? sub.textContent : 'No volunteers yet'));
      if (!role.hidden) visibleRoles.push(role);
    });
    setText(tools.querySelector('.wa-awaiting-filter'), 'Awaiting confirmation · ' + waiting);
    attr(tools.querySelector('.wa-awaiting-filter'), 'aria-pressed', s.awaiting);
    var allOpen = visibleRoles.length && visibleRoles.every(function (r) { return r.dataset.waOpen === 'true'; });
    setText(tools.querySelector('.wa-expand-roles'), allOpen ? 'Collapse all' : 'Expand all');
    tools.querySelector('.wa-expand-roles').disabled = !!query || s.awaiting;
    setText(tools.querySelector('.wa-roster-results'), query || s.awaiting ? matches + ' matching volunteer' + (matches === 1 ? '' : 's') : 'Open a role to manage its volunteers');
    team.querySelector('.wa-roster-no-results').hidden = !((query || s.awaiting) && !matches);
  }
  function enhance() {
    queued = false;
    var root = document.querySelector('#volunteering #w119.w191');
    if (!root) { closeContact(false); return; }
    if (active && !active.trigger.isConnected) closeContact(false);
    if (active) syncContactExtras(active.trigger.closest('[data-w119card]'), active.panel);
    if (!root.classList.contains('wa-serving-workspace')) root.classList.add('wa-serving-workspace');
    decorateFlow(root);
    var team = root.querySelector('#w191team');
    if (team && team.querySelector('.board')) {
      var teamHeader = team.querySelector(':scope > [data-w191team]');
      attr(teamHeader, 'role', 'button'); attr(teamHeader, 'tabindex', '0');
      attr(teamHeader, 'aria-expanded', team.classList.contains('open'));
      decorateShortages(team); decorateRoles(team);
    }
    if (pendingFocus && !pendingFocus.old.isConnected) {
      if (pendingFocus.route === location.hash && /^(BODY|HTML)$/.test(document.activeElement.tagName)) {
        var card = root.querySelector('[data-w119card="' + pendingFocus.id + '"]');
        var target = card && card.querySelector(pendingFocus.move ? '.wa-contact-trigger' : '.wa-status-trigger, [data-vlrstat]');
        if (!target || !target.getClientRects().length) target = team.querySelector('.wa-awaiting-filter');
        if (target) target.focus({ preventScroll: true });
      }
      pendingFocus = null;
    }
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(enhance); } }
  document.addEventListener('click', function (event) {
    var t = event.target.closest ? event.target : event.target.parentElement;
    if (active && !active.panel.contains(t) && !active.trigger.contains(t)) closeContact(false);
    var trigger = t.closest('#w191team .wa-contact-trigger');
    if (trigger) { event.preventDefault(); openContact(trigger); return; }
    if (t.closest('.wa-contact-close')) { closeContact(true); return; }
    var toggle = t.closest('#w191team .wa-role-toggle');
    if (toggle) {
      closeContact(false); var role = toggle.closest('[data-w119role]'), key = role.getAttribute('data-w119role');
      var s = state();
      if (s.query || s.awaiting) s.folded[key] = !s.folded[key];
      else s.open[key] = !s.open[key]; decorateRoles(document.getElementById('w191team')); return;
    }
    if (t.closest('#w191team .wa-awaiting-filter')) { closeContact(false); state().awaiting = !state().awaiting; state().folded = {}; decorateRoles(document.getElementById('w191team')); return; }
    if (t.closest('#w191team .wa-expand-roles')) {
      closeContact(false); var team = document.getElementById('w191team'), open = t.closest('button').textContent === 'Expand all';
      team.querySelectorAll('[data-w119role]').forEach(function (r) { state().open[r.getAttribute('data-w119role')] = open; }); decorateRoles(team); return;
    }
    if (t.closest('#w191team .wa-clear-roster')) {
      state().query = ''; state().awaiting = false; var input = document.querySelector('.wa-roster-search input'); input.value = ''; decorateRoles(document.getElementById('w191team')); input.focus();
    }
  });
  document.addEventListener('input', function (e) {
    if (!e.target.matches('#w191team .wa-roster-search input')) return;
    closeContact(false); state().query = e.target.value; state().folded = {}; decorateRoles(document.getElementById('w191team'));
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && active) { e.preventDefault(); e.stopImmediatePropagation(); closeContact(true); }
    var stage = e.target.closest('.wa-serving-workspace .w191bar [data-w191stage]');
    if (stage && ['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
      e.preventDefault(); var buttons = Array.from(stage.parentElement.querySelectorAll('[data-w191stage]')), i = buttons.indexOf(stage);
      buttons[e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length].focus();
    }
    var team = e.target.closest('.wa-serving-workspace [data-w191team]');
    if (team && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); team.click(); }
  }, true);
  document.addEventListener('click', function (e) {
    var header = e.target.closest && e.target.closest('.wa-serving-workspace [data-w191team]');
    if (header) {
      attr(header, 'aria-expanded', header.parentElement.classList.contains('open'));
      if (!header.parentElement.classList.contains('open')) closeContact(false);
    }
  }, true);
  document.addEventListener('focusin', function (e) {
    if (active && !active.panel.contains(e.target) && e.target !== active.trigger) closeContact(false);
  });
  document.addEventListener('change', function (e) {
    if (!e.target.matches('#w191team [data-w119mv], #w191team [data-vlrstat]')) return;
    var move = e.target.hasAttribute('data-w119mv');
    pendingFocus = { old: e.target, id: e.target.getAttribute(move ? 'data-w119mv' : 'data-vlrstat'), route: location.hash, move: move };
    if (move) { state().open[e.target.value] = true; closeContact(false); }
  }, true);
  window.addEventListener('resize', positionContact);
  document.addEventListener('scroll', positionContact, true);
  window.addEventListener('hashchange', function () { closeContact(false); schedule(); });
  function boot() {
    var section = document.getElementById('volunteering'); if (!section) return;
    new MutationObserver(function (records) {
      if (records.some(function (m) { return !m.target.closest || !m.target.closest('[data-wa-enhancement]'); })) schedule();
    }).observe(section, { childList: true, subtree: true });
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
