import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../build/src/153_wave153.seg', import.meta.url), 'utf8');
const pages = ['mypage', 'overview', 'volunteering', 'crm', 'partners', 'fund', 'studio',
  'hrcentre', 'finances', 'adminpanel', 'activity', 'orggoals', 'goals', 'projects', 'goalmap'];

function launcher(options = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><nav class="wa-nav"><div id="tabBar">' +
    pages.map(id => '<button class="tab" data-tab="' + id + '">' + id + '</button>').join('') +
    '</div></nav><main>' + pages.map(id => '<section id="' + id + '"></section>').join('') +
    '</main><div id="w163bar"><button data-w163slot="menu">Menu</button></div></body></html>',
  { url: 'http://hub.test/#mypage', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.eval("var MODE = 'staff'; var USER = { email: 'coordinator@example.invalid' }; " +
    "var WA40_MINE = { role: 'admin' }; var WA_ME = { department: 'opsmtl' }; function isStaff() { return MODE === 'staff'; }");
  if (options.board) window.eval("MODE = 'board';");
  if (options.member) {
    window.eval("WA40_MINE = { role: 'member', profile: 'opsmtl' };");
    for (const tab of window.document.querySelectorAll('.tab')) {
      if (!['mypage', 'overview', 'volunteering', 'crm'].includes(tab.dataset.tab)) tab.style.display = 'none';
    }
  }
  if (options.width) Object.defineProperty(window, 'innerWidth', { value: options.width, configurable: true });
  window.eval(source);
  window.w153.paint();
  return { dom, window, document: window.document };
}

function search(context, query) {
  const input = context.document.querySelector('#w153appSearch');
  input.value = query;
  input.dispatchEvent(new context.window.Event('input', { bubbles: true }));
  return input;
}

function key(context, name) {
  context.document.activeElement.dispatchEvent(new context.window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
}

function visibleApps(context) {
  return [...context.document.querySelectorAll('[data-w153app]:not([hidden])')].map(row => row.dataset.w153app);
}

test('launcher searches only the apps the current member can open and keeps team ordering', t => {
  const context = launcher({ member: true });
  t.after(() => context.dom.window.close());
  context.window.w153.pop();
  assert.deepEqual(visibleApps(context), ['hub', 'volunteer', 'crm']);
  assert.equal(context.document.querySelectorAll('.w153appGroup[aria-label="More apps"]').length, 1);
  search(context, 'admin');
  assert.deepEqual(visibleApps(context), []);
  assert.equal(context.document.querySelector('.w153appEmpty').hidden, false);
  assert.equal(context.document.querySelector('[data-w153app="admin"]'), null);
});

test('opening the Apps dialog focuses search, marks the current workspace and exposes its control relationship', t => {
  const context = launcher();
  t.after(() => context.dom.window.close());
  context.document.querySelector('[data-w153grid]').click();
  assert.equal(context.document.activeElement.id, 'w153appSearch');
  assert.equal(context.document.querySelector('[data-w153grid]').getAttribute('aria-expanded'), 'true');
  assert.equal(context.document.querySelector('[data-w153grid]').getAttribute('aria-controls'), 'w153pop');
  assert.equal(context.document.querySelector('[data-w153app="hub"]').getAttribute('aria-current'), 'true');
  assert.equal(context.document.querySelector('.w153current').textContent, 'Current');
});

test('repainting access-dependent content preserves the search, caret, focus and scroll position', t => {
  const context = launcher();
  t.after(() => context.dom.window.close());
  context.window.w153.pop();
  const input = search(context, 'volun');
  input.setSelectionRange(1, 4, 'backward');
  context.document.querySelector('#w153appResults').scrollTop = 60;
  context.window.w153.paint();
  const repainted = context.document.querySelector('#w153appSearch');
  assert.equal(repainted.value, 'volun');
  assert.equal(context.document.activeElement, repainted);
  assert.equal(repainted.selectionStart, 1);
  assert.equal(repainted.selectionEnd, 4);
  assert.equal(repainted.selectionDirection, 'backward');
  assert.equal(context.document.querySelector('#w153appResults').scrollTop, 60);
  assert.deepEqual(visibleApps(context), ['volunteer']);
});

test('keyboard search opens the existing app destination and Escape restores the Apps trigger', t => {
  const context = launcher();
  t.after(() => context.dom.window.close());
  context.window.w153.pop();
  search(context, 'volunteer');
  key(context, 'ArrowDown');
  assert.equal(context.document.activeElement.dataset.w153app, 'volunteer');
  key(context, 'ArrowUp');
  assert.equal(context.document.activeElement.dataset.w153app, 'volunteer');
  key(context, '/');
  assert.equal(context.document.activeElement.id, 'w153appSearch');
  key(context, 'Enter');
  assert.equal(context.window.location.hash, '#volunteering');
  assert.equal(context.window.w153.state().open, false);
  context.window.w153.pop();
  key(context, 'Escape');
  assert.equal(context.document.activeElement.hasAttribute('data-w153grid'), true);
  assert.equal(context.document.querySelector('[data-w153grid]').getAttribute('aria-expanded'), 'false');
});

test('an empty result cannot navigate and Clear search restores the full authorized list', t => {
  const context = launcher();
  t.after(() => context.dom.window.close());
  context.window.w153.pop();
  const all = visibleApps(context);
  search(context, 'no-such-app');
  key(context, 'ArrowDown');
  key(context, 'Enter');
  assert.equal(context.window.location.hash, '#mypage');
  assert.equal(context.window.w153.state().open, true);
  context.document.querySelector('[data-w153appclear]').click();
  assert.deepEqual(visibleApps(context), all);
  assert.equal(context.document.activeElement.id, 'w153appSearch');
  assert.equal(context.document.querySelector('.w153appEmpty').hidden, true);
});

test('refreshing permissions removes inaccessible choices while retaining the typed query', t => {
  const context = launcher();
  t.after(() => context.dom.window.close());
  context.window.w153.pop();
  search(context, 'admin');
  assert.deepEqual(visibleApps(context), ['admin']);
  context.document.querySelector('[data-tab="adminpanel"]').style.display = 'none';
  context.document.querySelector('[data-tab="activity"]').style.display = 'none';
  context.window.w153.paint();
  assert.deepEqual(visibleApps(context), []);
  assert.equal(context.document.querySelector('#w153appSearch').value, 'admin');
});

test('closing on a phone returns focus to Menu and reopening starts with an empty search', t => {
  const context = launcher({ width: 390 });
  t.after(() => context.dom.window.close());
  context.window.w153.pop();
  search(context, 'finance');
  context.document.body.classList.add('w130typing');
  context.document.querySelector('[data-w153popclose]').click();
  assert.equal(context.document.body.classList.contains('w130typing'), false);
  assert.equal(context.document.activeElement.getAttribute('data-w163slot'), 'menu');
  context.window.w153.pop();
  assert.equal(context.document.querySelector('#w153appSearch').value, '');
  assert.equal(context.document.querySelector('#w153pop').style.width, '366px');
});

test('the website remains an external link and board mode cannot open the app launcher', t => {
  const context = launcher();
  const board = launcher({ board: true });
  t.after(() => { context.dom.window.close(); board.dom.window.close(); });
  context.window.w153.pop();
  const website = context.document.querySelector('[data-w153ext="website"]');
  assert.equal(website.href, 'https://welfareavenue.com/');
  assert.equal(website.target, '_blank');
  assert.equal(website.rel, 'noopener');
  board.window.w153.pop();
  assert.equal(board.window.w153.state().open, false);
});

test('Volunteer Manager exposes the approved direct page links through the existing access gate', t => {
  const context = launcher({ member: true });
  t.after(() => context.dom.window.close());
  const refresh = readFileSync(new URL('../build/src/259_wave259.seg', import.meta.url), 'utf8');
  context.window.eval(refresh);
  const routes = [...context.window.WA_APP.items('volunteer')].flatMap(group => [...group.items].map(item => item.h));
  for (const page of ['sop', 'recipes', 'people', 'applicants', 'phone', 'signoffs', 'setup']) {
    assert.equal(routes.includes('#volunteering/' + page), true, page);
  }
  assert.equal(routes.some(route => /storage/.test(route)), false);
});
