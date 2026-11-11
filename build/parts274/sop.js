/* Local SOP audit experiment. Original save/edit/reorder controls remain the action source. */
(function () {
  'use strict';
  var ui = { stage: 'all', query: '', unassigned: false, open: {}, folded: {} }, queued = false, popup = null, peopleRequested = false;
  var phaseInfo = [
    ['plan', 'Plan', '2+ weeks before', 'Location, format & meal target', '#467a68', '#e8f1e9', 'M5 4h14v17H5zM8 2v4m8-4v4M8 10h8m-8 4h5'],
    ['recruit', 'Recruit', '2 weeks before', 'Roles, outreach & coverage', '#3e739c', '#e7f0f8', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 8v6m-3-3h6'],
    ['confirm', 'Confirm', '7 days before', 'Responses, recipes & final checks', '#7663a5', '#eee9f7', 'M22 11v1a10 10 0 1 1-6-9M22 4 12 14l-3-3'],
    ['prepare', 'Prepare', 'The days before', 'Itinerary, supplies & briefing', '#a47a21', '#f9efda', 'M5 7h14v14H5zM8 7V4h8v3M9 13l2 2 4-4'],
    ['day_of', 'Day of', 'Serving day', 'Arrival, service & handover', '#3b8582', '#e5f2ef', 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0'],
    ['wrap_up', 'Wrap up', 'After the serving', 'Equipment, feedback & follow-up', '#a16762', '#f6eae5', 'M4 22V3m0 1c5-4 11 4 16 0v11c-5 4-11-4-16 0']
  ];
  function el(tag, cls, text) {
    var n = document.createElement(tag); if (cls) n.className = cls;
    if (text != null) n.textContent = text; n.dataset.waEnhancement = '1'; return n;
  }
  function text(n, value) { if (n && n.textContent !== value) n.textContent = value; }
  function attr(n, key, value) { if (n.getAttribute(key) !== String(value)) n.setAttribute(key, value); }
  function icon(path) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); n.setAttribute('viewBox', '0 0 24 24'); n.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(n.namespaceURI, 'path'); p.setAttribute('d', path); n.append(p); return n;
  }
  function initials(value) { return value.trim().split(/\s+/).map(function (s) { return s[0]; }).slice(0, 2).join('').toUpperCase() || '+'; }
  function stage(row, index) {
    var label = row.querySelector('.w191stg');
    return phaseInfo.find(function (p) { return label && p[1].toLowerCase() === label.textContent.trim().toLowerCase(); }) || phaseInfo[index] || phaseInfo[0];
  }
  function color(n, info) {
    if (n.style.getPropertyValue('--sop-ink') !== info[4]) n.style.setProperty('--sop-ink', info[4]);
    if (n.style.getPropertyValue('--sop-paper') !== info[5]) n.style.setProperty('--sop-paper', info[5]);
  }
  function ownerSelect(row) { return row.querySelector('[data-vlowner]'); }
  function prepareOwner(row) {
    var field = ownerSelect(row); if (!field) return null;
    if (field.tagName === 'INPUT') {
      var select = document.createElement('select'), value = field.value;
      Array.from(field.attributes).forEach(function (a) { if (!['type', 'value', 'placeholder'].includes(a.name)) select.setAttribute(a.name, a.value); });
      select.dataset.waSopCreated = '1'; field.replaceWith(select); field = select;
      field.append(new Option('Unassigned', '')); if (value) field.append(new Option(value, value)); field.value = value;
    }
    if (field.dataset.waSopCreated) {
      var current = field.value, names = new Set();
      if (typeof WA28_PEOPLE !== 'undefined') WA28_PEOPLE.forEach(function (p) { if (p.name) names.add(p.name); });
      document.querySelectorAll('#w47roles [data-w47rb] option').forEach(function (o) { if (o.value) names.add(o.value); });
      document.querySelectorAll('.wa-sop-workspace [data-vlowner]').forEach(function (input) { if (input.value) names.add(input.value); });
      if (current) names.add(current);
      var ordered = Array.from(names).sort(), signature = JSON.stringify(ordered);
      if (field.dataset.waSopOptions !== signature) {
        field.replaceChildren(new Option('Unassigned', '')); ordered.forEach(function (name) { field.append(new Option(name, name)); });
        field.value = current; field.dataset.waSopOptions = signature;
      }
    }
    return field;
  }
  function syncOwner(select) {
    var button = select.previousElementSibling;
    if (!button || !button.classList.contains('wa-sop-owner')) {
      button = el('button', 'wa-sop-owner'); button.type = 'button'; button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-expanded', 'false');
      button.append(el('span', 'wa-sop-avatar'), el('span', 'wa-sop-owner-name'), el('span', 'wa-sop-chevron')); select.before(button);
    }
    var name = select.selectedOptions[0]?.textContent || select.value || 'Unassigned';
    if (!select.value) name = select.hasAttribute('data-w47rb') ? 'Choose owner' : 'Unassigned';
    text(button.querySelector('.wa-sop-avatar'), select.value ? initials(name) : '+');
    text(button.querySelector('.wa-sop-owner-name'), name); attr(button, 'data-empty', !select.value);
    var row = select.closest('.vl-step'), title = row?.querySelector('.wa-sop-title')?.textContent || select.closest('.w46row')?.querySelector('b')?.textContent || 'this step';
    attr(button, 'aria-label', 'Assign owner for ' + title);
    var emptyBundle = select.hasAttribute('data-w47rb') && /^0\b/.test(select.closest('.w46row')?.querySelector('.w46days')?.textContent || '');
    button.disabled = select.disabled || emptyBundle;
    attr(button, 'title', emptyBundle ? 'Use Edit bundle to link steps before assigning an owner' : name + ' · Change owner');
    var focus = document.activeElement === select;
    attr(select, 'data-wa-sop-ready', 'true'); attr(select, 'aria-hidden', 'true'); attr(select, 'tabindex', '-1');
    if (focus) button.focus({ preventScroll: true });
    return button;
  }
  function closePopup(focus) {
    if (!popup) return;
    var current = popup; popup = null; current.panel.remove(); current.trigger.setAttribute('aria-expanded', 'false');
    current.trigger.removeAttribute('aria-controls');
    if (focus && current.trigger.isConnected) current.trigger.focus({ preventScroll: true });
  }
  function positionPopup() {
    if (!popup) return;
    if (!popup.trigger.isConnected || !popup.trigger.getClientRects().length) { closePopup(false); return; }
    var a = popup.trigger.getBoundingClientRect(), p = popup.panel, r = p.getBoundingClientRect();
    if (a.bottom < 0 || a.top > innerHeight) { closePopup(false); return; }
    var top = a.bottom + 7;
    if (top + r.height > innerHeight - 12 && a.top - r.height - 7 > 12) top = a.top - r.height - 7;
    p.style.top = Math.max(12, Math.min(top, innerHeight - r.height - 12)) + 'px';
    p.style.left = Math.max(12, Math.min(a.right - r.width, innerWidth - r.width - 12)) + 'px';
  }
  function openOwner(trigger) {
    if (popup?.trigger === trigger) { closePopup(true); return; }
    closePopup(false); var select = trigger.nextElementSibling; if (!select || trigger.disabled) return;
    var panel = el('div', 'wa-sop-popup wa-sop-people'); panel.id = 'wa-sop-owner-picker'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', trigger.getAttribute('aria-label'));
    var label = el('label', 'wa-sop-person-search'); label.append(icon('m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0'));
    var search = el('input'); search.type = 'search'; search.placeholder = 'Find a person'; search.setAttribute('aria-label', 'Find an owner'); label.append(search); panel.append(label);
    var list = el('div', 'wa-sop-person-list'); list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Available owners');
    Array.from(select.options).forEach(function (option) {
      if (option.disabled) return;
      var choice = el('button', 'wa-sop-person'); choice.type = 'button'; choice.dataset.value = option.value;
      choice.setAttribute('role', 'option'); choice.setAttribute('aria-selected', option.value === select.value); choice.tabIndex = -1;
      choice.append(el('span', 'wa-sop-avatar', option.value ? initials(option.textContent) : '–'), el('span', '', option.value ? option.textContent : 'Unassigned'), el('span', 'wa-sop-person-check', '✓'));
      list.append(choice);
    });
    panel.append(list, el('p', 'wa-sop-person-empty', 'No matching people.'));
    document.body.append(panel); popup = { trigger: trigger, panel: panel, select: select, kind: 'owner' };
    trigger.setAttribute('aria-controls', panel.id); trigger.setAttribute('aria-expanded', 'true'); filterPeople(''); positionPopup(); search.focus({ preventScroll: true });
  }
  function filterPeople(query) {
    if (!popup || popup.kind !== 'owner') return;
    var count = 0; popup.panel.querySelectorAll('.wa-sop-person').forEach(function (b) { b.hidden = !!query && !b.textContent.toLowerCase().includes(query.toLowerCase()); if (!b.hidden) count++; });
    popup.panel.querySelector('.wa-sop-person-empty').hidden = !!count;
  }
  function sources(row) {
    var nodes = [], next = row.nextElementSibling;
    while (next && next.classList.contains('wa24-sx')) { nodes.push(next); next = next.nextElementSibling; }
    return nodes;
  }
  function openActions(trigger) {
    if (popup?.trigger === trigger) { closePopup(true); return; }
    closePopup(false);
    var row = trigger.closest('.vl-step'), native = row ? sources(row).flatMap(function (n) { return Array.from(n.querySelectorAll('a.ed')); }) : Array.from(trigger.closest('.w46row').querySelectorAll('[data-w47rd]'));
    var panel = el('div', 'wa-sop-popup wa-sop-actions'); panel.id = 'wa-sop-step-actions'; panel.setAttribute('role', 'menu'); panel.setAttribute('aria-label', row ? 'Step actions' : 'Role bundle actions');
    var order = ['data-w24e', 'data-w25a', 'data-w26ph', 'data-w25u', 'data-w25d', 'data-w25x', 'data-w47rd'];
    native.sort(function (a, b) { return order.findIndex(function (key) { return a.hasAttribute(key); }) - order.findIndex(function (key) { return b.hasAttribute(key); }); });
    native.forEach(function (a) {
      var labels = { 'data-w24e': 'Edit step', 'data-w25a': 'Add a step here', 'data-w25u': 'Move up', 'data-w25d': 'Move down', 'data-w25x': 'Remove step', 'data-w26ph': 'Add a photo', 'data-w47rd': 'Delete bundle' };
      var key = Object.keys(labels).find(function (k) { return a.hasAttribute(k); }); if (!key) return;
      var b = el('button', a.hasAttribute('data-w25x') || a.hasAttribute('data-w47rd') ? 'wa-sop-action danger' : 'wa-sop-action', labels[key]);
      b.type = 'button'; b.setAttribute('role', 'menuitem'); b.tabIndex = -1; b._nativeAction = a; panel.append(b);
      if (row && ['data-w25u', 'data-w25d'].includes(key)) {
        var siblings = Array.from(row.closest('.vl-body').querySelectorAll('.vl-step'));
        b.disabled = key === 'data-w25u' ? siblings[0] === row : siblings[siblings.length - 1] === row;
      }
    });
    document.body.append(panel); popup = { trigger: trigger, panel: panel, kind: 'actions' }; trigger.setAttribute('aria-expanded', 'true'); trigger.setAttribute('aria-controls', panel.id);
    positionPopup(); panel.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }
  function decorateStep(row, index, info) {
    var name = row.querySelector('.vl-name'); if (!name) return;
    var title = name.querySelector('.wa-sop-title');
    if (!title) {
      title = el('span', 'wa-sop-title');
      var words = Array.from(name.childNodes).filter(function (n) { return n.nodeType === 3; });
      words.forEach(function (word) { title.append(word); }); name.append(title);
    }
    var sub = row.querySelector('.wa-sop-subline');
    if (!sub) { sub = el('div', 'wa-sop-subline'); row.querySelector('.vl-t').append(sub); }
    var more = name.querySelector('[data-vlmore]');
    if (more) { more.textContent = 'Instructions'; sub.append(more); }
    var originalMore = sub.querySelector('[data-vlmore]'), detail = row.querySelector('.vl-det');
    if (originalMore) { attr(originalMore, 'aria-expanded', !!detail?.classList.contains('open')); attr(originalMore, 'aria-controls', detail?.id || ''); }
    var extras = sources(row), help = extras.flatMap(function (n) { return Array.from(n.querySelectorAll('a.help')); })[0];
    if (help && !sub.querySelector('.wa-sop-help')) { var copy = help.cloneNode(true); copy.className = 'wa-sop-help'; sub.append(copy); }
    var tools = row.querySelector('.wa-sop-step-tools');
    if (!tools) {
      tools = el('div', 'wa-sop-step-tools');
      var edit = extras.flatMap(function (n) { return Array.from(n.querySelectorAll('[data-w24e]')); })[0];
      if (edit) { var b = el('button', 'wa-sop-edit', 'Edit'); b.type = 'button'; b._nativeAction = edit; b.setAttribute('aria-label', 'Edit ' + title.textContent.trim()); tools.append(b); }
      var actions = el('button', 'wa-sop-more', '⋯'); actions.type = 'button'; actions.setAttribute('aria-label', 'More actions for ' + title.textContent.trim()); actions.setAttribute('aria-haspopup', 'menu'); actions.setAttribute('aria-expanded', 'false'); tools.append(actions); row.append(tools);
    }
    color(row, info); row.dataset.waSopStage = info[0];
    var select = prepareOwner(row); if (select) syncOwner(select);
  }
  function buildHero(card, legend) {
    if (legend.querySelector('.wa-sop-journey')) return;
    var header = el('div', 'wa-sop-journey-head'), title = el('div');
    title.append(el('span', 'wa-sop-eyebrow', 'MASTER PLAYBOOK'), el('h2', '', 'From planning to follow-through'), el('p', '', 'Choose a stage to focus the checklist.'));
    header.append(title, el('span', 'wa-sop-total')); legend.append(header);
    var journey = el('div', 'wa-sop-journey');
    phaseInfo.forEach(function (p, i) {
      var b = el('button', 'wa-sop-stage'); b.type = 'button'; b.dataset.stage = p[0]; b.setAttribute('aria-pressed', 'false'); color(b, p);
      var top = el('div', 'wa-sop-stage-top'), badge = el('span', 'wa-sop-stage-icon'); badge.append(icon(p[6]));
      top.append(badge, el('span', 'wa-sop-stage-number', '0' + (i + 1)), el('span', 'wa-sop-stage-arrow', '→'));
      b.append(top, el('b', '', p[1]), el('span', 'wa-sop-stage-description', p[3]));
      var bottom = el('div', 'wa-sop-stage-bottom'); bottom.append(el('span', '', p[2]), el('small', 'wa-sop-stage-count')); b.append(bottom); journey.append(b);
    });
    legend.append(journey);
    var intro = card.querySelector(':scope > .vl-empty'), old = card.querySelector('#w191sopintro');
    if (intro && old) {
      var help = el('details', 'wa-sop-context'), summary = el('summary');
      summary.append(el('b', '', 'Master template'), el('span', '', 'Changes apply to upcoming planned servings'), el('span', 'wa-sop-context-link', 'How it works ⌄'));
      help.append(summary, intro, old); legend.before(help);
    }
  }
  function buildRoles(card) {
    var roles = card.querySelector('#w47roles'); if (!roles) return;
    var wrap = roles.closest('.wa-sop-role-bundles');
    if (!wrap) { wrap = el('details', 'wa-sop-role-bundles'); var summary = el('summary'); summary.append(el('b', '', 'Role bundles'), el('span', '', 'Assign several linked steps together'), el('small', 'wa-sop-role-count')); wrap.append(summary); card.append(wrap); wrap.append(roles); }
    text(wrap.querySelector('.wa-sop-role-count'), roles.querySelectorAll('.w46row').length + ' bundles');
    roles.querySelectorAll('.w46row').forEach(function (row) {
      var count = row.querySelector('.w46days'); if (count && !count.textContent.includes('linked')) text(count, count.textContent.replace('steps', 'linked steps'));
      var select = row.querySelector('[data-w47rb]'); if (select) syncOwner(select);
      var edit = row.querySelector('[data-w47re]'); if (edit) { text(edit, /^0\b/.test(count?.textContent || '') ? 'Link steps' : 'Edit bundle'); attr(edit, 'role', 'button'); attr(edit, 'tabindex', '0'); attr(edit, 'aria-label', 'Edit ' + row.querySelector('b').textContent + ' bundle'); }
      if (!row.querySelector('.wa-sop-more')) { var more = el('button', 'wa-sop-more', '⋯'); more.type = 'button'; more.setAttribute('aria-label', 'More actions for ' + row.querySelector('b').textContent); more.setAttribute('aria-haspopup', 'menu'); more.setAttribute('aria-expanded', 'false'); row.append(more); }
    });
    var create = roles.querySelector('[data-w47ra]'); if (create) { attr(create, 'role', 'button'); attr(create, 'tabindex', '0'); }
  }
  function buildToolbar(card) {
    var toolbar = card.querySelector('.wa-sop-toolbar'); if (toolbar) return toolbar;
    toolbar = el('div', 'wa-sop-toolbar');
    var head = el('div', 'wa-sop-toolbar-head'), labels = el('div'); labels.append(el('h3', '', 'Master checklist'), el('span', 'wa-sop-result'));
    var add = el('button', 'wa-sop-new', '+ New section'); add.type = 'button';
    head.append(labels, add); toolbar.append(head);
    var controls = el('div', 'wa-sop-controls'), search = el('label', 'wa-sop-search'); search.append(icon('m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0'));
    var input = el('input'); input.type = 'search'; input.placeholder = 'Find a step or owner'; input.setAttribute('aria-label', 'Search the SOP'); input.value = ui.query; search.append(input);
    var missing = el('button', 'wa-sop-unassigned'); missing.type = 'button';
    controls.append(search, missing); toolbar.append(controls);
    var filter = el('div', 'wa-sop-filter-row'), all = el('button', 'wa-sop-all', 'All stages'); all.type = 'button';
    var bundle = el('button', 'wa-sop-bundles-link', 'Role bundles'), expand = el('button', 'wa-sop-expand', 'Expand all'); bundle.type = expand.type = 'button';
    var clear = el('button', 'wa-sop-clear', 'Clear filters'); clear.type = 'button';
    filter.append(all, el('span', 'wa-sop-filter-label'), clear, el('span', 'wa-sop-spacer'), bundle, expand); toolbar.append(filter);
    var first = card.querySelector(':scope > .vl-phase'); first.before(toolbar);
    var empty = el('div', 'wa-sop-no-results'); empty.hidden = true; empty.append(el('b', '', 'No steps match these filters.'), el('p', '', 'Try another name, owner or stage.'));
    var reset = el('button', 'wa-sop-clear', 'Clear filters'); reset.type = 'button'; empty.append(reset); toolbar.after(empty);
    return toolbar;
  }
  function update(card) {
    var toolbar = buildToolbar(card), phases = Array.from(card.querySelectorAll(':scope > .vl-phase')), counts = {}, total = 0, unassigned = 0, visibleCount = 0, visiblePhases = [];
    phaseInfo.forEach(function (p) { counts[p[0]] = { total: 0, assigned: 0 }; });
    var initial = !Object.keys(ui.open).length && !phases.some(function (p) { return p.open; });
    phases.forEach(function (phase, phaseIndex) {
      var summary = phase.querySelector(':scope > summary'), rows = Array.from(phase.querySelectorAll('.vl-step[data-vlstep^="tmpl-"]'));
      if (!phase.dataset.waSopSection) phase.dataset.waSopSection = Array.from(summary.childNodes).filter(function (n) { return n.nodeType === 3; }).map(function (n) { return n.textContent; }).join('').trim() || 'SOP section';
      var key = phase.dataset.waSopSection;
      if (!(key in ui.open)) ui.open[key] = phase.open || (initial && phaseIndex === 0);
      var info = stage(rows[0] || phase, phaseIndex), matches = 0, assigned = 0;
      rows.forEach(function (row, i) {
        var meta = stage(row, phaseIndex); decorateStep(row, i, meta);
        var select = ownerSelect(row), hasOwner = !!select?.value; total++;
        counts[meta[0]].total++; if (hasOwner) { assigned++; counts[meta[0]].assigned++; }
        var title = row.querySelector('.wa-sop-title').textContent, hay = (title + ' ' + (select?.value || '') + ' ' + key).toLowerCase();
        var context = (ui.stage === 'all' || ui.stage === meta[0]) && (!ui.query.trim() || ui.query.toLowerCase().trim().split(/\s+/).every(function (word) { return hay.includes(word); }));
        if (context && !hasOwner) unassigned++;
        var hit = context && (!ui.unassigned || !hasOwner);
        row.hidden = !hit; if (hit) matches++;
      });
      if (!summary.querySelector('.wa-sop-section-name')) {
        summary.replaceChildren();
        var number = el('span', 'wa-sop-section-icon'); number.append(icon(info[6]));
        var name = el('span', 'wa-sop-section-name'); name.append(el('b', '', key), el('small', 'wa-sop-section-meta'));
        summary.append(number, name, el('span', 'wa-sop-section-count'), el('span', 'wa-sop-chevron'));
      }
      color(phase, info);
      text(summary.querySelector('.wa-sop-section-meta'), info[1] + ' · ' + assigned + ' of ' + rows.length + ' owners assigned');
      text(summary.querySelector('.wa-sop-section-count'), matches + ' step' + (matches === 1 ? '' : 's'));
      phase.hidden = !matches; visibleCount += matches; if (matches) visiblePhases.push(phase);
      var filtering = ui.stage !== 'all' || !!ui.query.trim() || ui.unassigned;
      var wantOpen = filtering ? !ui.folded[key] : ui.open[key];
      if (phase.open !== wantOpen) { phase._waSopExpected = wantOpen; phase.open = wantOpen; }
      phase.dataset.waSopFiltering = String(filtering);
    });
    card.querySelectorAll('.wa-sop-stage').forEach(function (b) { var c = counts[b.dataset.stage], missing = c.total - c.assigned, label = b.querySelector('.wa-sop-stage-count'); text(label, c.total + ' steps · ' + (missing ? missing + (missing === 1 ? ' needs an owner' : ' need owners') : c.assigned + ' assigned')); attr(label, 'data-missing', missing > 0); attr(b, 'aria-pressed', ui.stage === b.dataset.stage); });
    text(card.querySelector('.wa-sop-total'), total + ' steps / 6 stages');
    text(toolbar.querySelector('.wa-sop-result'), visibleCount + ' of ' + total + ' steps' + (ui.stage === 'all' ? ' · all stages' : ' · ' + phaseInfo.find(function (p) { return p[0] === ui.stage; })[1]));
    text(toolbar.querySelector('.wa-sop-unassigned'), 'Needs an owner · ' + unassigned); attr(toolbar.querySelector('.wa-sop-unassigned'), 'aria-pressed', ui.unassigned);
    attr(toolbar.querySelector('.wa-sop-all'), 'aria-pressed', ui.stage === 'all');
    text(toolbar.querySelector('.wa-sop-filter-label'), ui.stage === 'all' ? 'Drag handles to reorder · ⋯ for more actions' : phaseInfo.find(function (p) { return p[0] === ui.stage; })[1] + ' stage');
    var filtered = ui.stage !== 'all' || ui.query || ui.unassigned; toolbar.querySelector('.wa-sop-clear').hidden = !filtered;
    text(toolbar.querySelector('.wa-sop-expand'), visiblePhases.length && visiblePhases.every(function (p) { return p.open; }) ? 'Collapse all' : 'Expand all');
    card.querySelector('.wa-sop-no-results').hidden = visibleCount > 0;
  }
  function currentCard() { return location.hash.split('?')[0] === '#volunteering/sop' ? document.querySelector('#volunteering #w191legend')?.closest('.card') : null; }
  function enhance() {
    queued = false; var card = currentCard(); if (!card) { closePopup(false); return; }
    if (!peopleRequested && typeof wa28Load === 'function') { peopleRequested = true; wa28Load(false).then(schedule); }
    if (popup && !popup.trigger.isConnected) closePopup(false);
    if (!card.classList.contains('wa-sop-workspace')) card.classList.add('wa-sop-workspace');
    buildHero(card, card.querySelector('#w191legend')); buildRoles(card); update(card);
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(enhance); } }
  document.addEventListener('click', function (event) {
    var target = event.target.closest ? event.target : event.target.parentElement;
    if (popup && !popup.panel.contains(target) && !popup.trigger.contains(target)) closePopup(false);
    var owner = target.closest('.wa-sop-owner'); if (owner) { event.preventDefault(); openOwner(owner); return; }
    var person = target.closest('.wa-sop-person');
    if (person && popup?.kind === 'owner') { var select = popup.select, changed = select.value !== person.dataset.value; select.value = person.dataset.value; syncOwner(select); closePopup(true); if (changed) select.dispatchEvent(new Event('change', { bubbles: true })); schedule(); return; }
    var action = target.closest('.wa-sop-action, .wa-sop-edit'); if (action?._nativeAction) { var original = action._nativeAction; closePopup(true); original.click(); return; }
    var more = target.closest('.wa-sop-more'); if (more) { event.preventDefault(); openActions(more); return; }
    var card = currentCard(); if (!card) return;
    if (target.closest('.wa-sop-stage')) {
      ui.stage = target.closest('.wa-sop-stage').dataset.stage; ui.folded = {}; update(card);
      card.querySelector('.wa-sop-toolbar').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      card.querySelector(':scope > .vl-phase:not([hidden]) > summary')?.focus({ preventScroll: true }); return;
    }
    if (target.closest('.wa-sop-all')) { ui.stage = 'all'; ui.folded = {}; update(card); return; }
    if (target.closest('.wa-sop-unassigned')) { ui.unassigned = !ui.unassigned; ui.folded = {}; update(card); return; }
    if (target.closest('.wa-sop-clear')) { ui.stage = 'all'; ui.query = ''; ui.unassigned = false; ui.folded = {}; card.querySelector('.wa-sop-search input').value = ''; update(card); return; }
    if (target.closest('.wa-sop-expand')) {
      var open = target.closest('button').textContent === 'Expand all';
      card.querySelectorAll(':scope > .vl-phase:not([hidden])').forEach(function (p) { ui.open[p.dataset.waSopSection] = open; ui.folded[p.dataset.waSopSection] = !open; p.open = open; }); update(card); return;
    }
    if (target.closest('.wa-sop-bundles-link')) { var role = card.querySelector('.wa-sop-role-bundles'); role.open = true; role.scrollIntoView({ behavior: 'smooth', block: 'center' }); role.querySelector('summary').focus({ preventScroll: true }); return; }
    if (target.closest('.wa-sop-new')) { card.querySelector('[data-w25sec]')?.click(); return; }
    if (target.closest('.wa-sop-subline [data-vlmore]')) requestAnimationFrame(function () { var b = target.closest('[data-vlmore]'); attr(b, 'aria-expanded', b.closest('.vl-step').querySelector('.vl-det')?.classList.contains('open')); });
  });
  document.addEventListener('input', function (event) {
    if (event.target.matches('.wa-sop-search input')) { ui.query = event.target.value; ui.folded = {}; update(currentCard()); }
    if (event.target.matches('.wa-sop-person-search input')) filterPeople(event.target.value);
  });
  document.addEventListener('change', function (event) { if (event.target.matches('.wa-sop-workspace select[data-vlowner], .wa-sop-workspace select[data-w47rb]')) { syncOwner(event.target); schedule(); } });
  document.addEventListener('toggle', function (event) {
    var phase = event.target;
    if (!phase.matches('.wa-sop-workspace > .vl-phase')) return;
    var automated = phase._waSopExpected === phase.open; delete phase._waSopExpected;
    if (!automated && phase.dataset.waSopSection) { ui.open[phase.dataset.waSopSection] = phase.open; if (phase.dataset.waSopFiltering === 'true') ui.folded[phase.dataset.waSopSection] = !phase.open; }
    var card = currentCard(), button = card?.querySelector('.wa-sop-expand');
    if (button) { var all = Array.from(card.querySelectorAll(':scope > .vl-phase:not([hidden])')); text(button, all.length && all.every(function (p) { return p.open; }) ? 'Collapse all' : 'Expand all'); }
  }, true);
  document.addEventListener('keydown', function (event) {
    if (popup && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closePopup(true); return; }
    if (popup && event.key === 'Tab' && popup.panel.contains(event.target)) { closePopup(true); return; }
    if (popup && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && popup.panel.contains(event.target)) {
      if (event.target.matches('.wa-sop-person-search input') && ['Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopImmediatePropagation(); var choices = Array.from(popup.panel.querySelectorAll('.wa-sop-person:not([hidden]), .wa-sop-action:not(:disabled)')), i = choices.indexOf(document.activeElement);
      var at = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : i === -1 ? (event.key === 'ArrowDown' ? 0 : choices.length - 1) : (i + (event.key === 'ArrowDown' ? 1 : choices.length - 1)) % choices.length;
      choices[at]?.focus({ preventScroll: true }); return;
    }
    if (event.target.matches('.wa-sop-person-search input') && event.key === 'Enter') { event.preventDefault(); popup?.panel.querySelector('.wa-sop-person:not([hidden])')?.click(); return; }
    if (event.target.matches('.wa-sop-workspace [role="button"]:not(button)') && ['Enter', ' '].includes(event.key)) { event.preventDefault(); event.target.click(); }
  }, true);
  document.addEventListener('focusin', function (event) { if (popup && !popup.panel.contains(event.target) && !popup.trigger.contains(event.target)) closePopup(false); });
  document.addEventListener('scroll', positionPopup, true); window.addEventListener('resize', positionPopup); window.addEventListener('hashchange', function () { closePopup(false); schedule(); });
  function boot() { var section = document.getElementById('volunteering'); if (!section) return;
    new MutationObserver(function (records) { if (records.some(function (r) { return !r.target.closest || !r.target.closest('[data-wa-enhancement]'); })) schedule(); }).observe(section, { childList: true, subtree: true }); schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
