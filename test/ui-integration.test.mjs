import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const part = name => readFileSync(new URL('../build/parts274/' + name, import.meta.url), 'utf8');

async function screen(html, hash, scripts, setup) {
  const dom = new JSDOM('<!doctype html><html><head></head><body>' + html + '</body></html>',
    { url: 'http://hub.test/' + hash, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = () => ({ matches: true, addEventListener() {} });
  window.HTMLElement.prototype.getClientRects = function () { return [this.getBoundingClientRect()]; };
  window.HTMLElement.prototype.getBoundingClientRect = function () { return new window.DOMRect(30, 80, 220, 50); };
  if (setup) setup(window);
  for (const source of scripts) window.eval(source);
  await new Promise(resolve => window.setTimeout(resolve, 35));
  return { dom, window, document: window.document, settle: () => new Promise(resolve => window.setTimeout(resolve, 35)) };
}

function sidebarFixture() {
  const top = ['mypage', 'training', 'overview', 'requests', 'calendar', 'brain', 'orgchart', 'ourstory', 'hubmail', 'importantinfo', 'bank', 'agendas', 'documents', 'transcripts', 'photos'];
  return '<nav class="wa-nav"><div id="tabBar">' + top.map(id => '<button class="tab" data-tab="' + id + '">' + id + '</button>').join('') +
    '<span class="tab-group" data-w42g="departments"><button class="tab-group-h">Teams</button><div class="tab-group-p">' +
    '<div class="w42d"><button class="tab" data-tab="opsmtl">Operations Montreal</button><span class="w116chev">▼</span><div class="w42sub"><button class="tab" data-tab="opsmtl-tasks">Tasks</button></div></div>' +
    '<div class="w42d"><button class="tab" data-tab="hr" style="display:none">Human Resources</button><div class="w42sub"><button class="tab" data-tab="training-help">Training help</button></div></div>' +
    '</div></span></div></nav><main></main>';
}

test('sidebar restores the six primary links and three groups while keeping destination handlers', async t => {
  const native = readFileSync(new URL('../build/src/134_wave134.seg', import.meta.url), 'utf8');
  let original, calls = 0;
  const context = await screen(sidebarFixture(), '#mypage', [native, part('sidebar.js')], window => {
    window.WA_NAV = {};
    window.eval("var MODE='staff'; var WA_ME={department:'opsmtl'};");
    original = window.document.querySelector('[data-tab="opsmtl"]');
    original.addEventListener('click', () => { calls++; });
  });
  t.after(() => context.dom.window.close());
  context.window.w134.apply();
  await context.settle();
  const top = [...context.document.querySelectorAll('#tabBar > .tab')].slice(0, 6).map(button => button.dataset.tab);
  assert.deepEqual(top, ['mypage', 'training', 'overview', 'requests', 'calendar', 'brain']);
  const groups = [...context.document.querySelectorAll('#tabBar > [data-nav-section]')];
  assert.deepEqual(groups.map(group => group.dataset.navSection), ['departments', 'org', 'tools']);
  context.document.querySelector('#nav-section-departments').click();
  assert.equal(context.document.querySelector('#nav-panel-departments').hidden, false);
  assert.equal(original, context.document.querySelector('[data-tab="opsmtl"]'));
  assert.equal(original.nextElementSibling.nextElementSibling.hidden, true);
  original.click();
  await context.settle();
  assert.equal(calls, 1);
  assert.equal(context.document.querySelector('#nav-panel-departments').hidden, true);
});

test('sidebar keeps permitted subpages accessible and Escape returns focus to its group', async t => {
  const native = readFileSync(new URL('../build/src/134_wave134.seg', import.meta.url), 'utf8');
  const context = await screen(sidebarFixture(), '#mypage', [native, part('sidebar.js')], window => {
    window.WA_NAV = {};
    window.eval("var MODE='staff';");
  });
  t.after(() => context.dom.window.close());
  context.window.w134.apply();
  await context.settle();
  const heading = context.document.querySelector('#nav-section-departments');
  heading.click();
  const allowed = context.document.querySelector('[data-tab="training-help"]');
  assert.equal(allowed.closest('.w42sub').hidden, false);
  assert.equal(allowed.closest('[data-nav-section]').hidden, false);
  allowed.focus();
  allowed.dispatchEvent(new context.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(heading.getAttribute('aria-expanded'), 'false');
  assert.equal(context.document.activeElement, heading);
});

test('serving UI uses role disclosures and reveals contact details without replacing native actions', async t => {
  let originalMove;
  const context = await screen('<section id="volunteering"><div id="w119" class="w191">' +
    '<div class="w191bar"><button data-w191stage="plan" class="done"><b>Plan</b><span>Done</span></button></div>' +
    '<section id="w191team" class="open"><div data-w191team>The team</div><div class="b">' +
    '<div class="w191own"><div class="w191line"><button class="pill" data-w119bench="cook">Cooks 1/1</button><button class="pill short" data-w119bench="driver">Drivers 0/1</button></div></div>' +
    '<div class="board"><div class="rc" data-w119role="cook"><div class="h"><b>Cooks</b><span class="n">1/1</span></div><div class="sub">One confirmed</div>' +
    '<div data-w119card="42"><b>Alex Example</b><div class="st"><select data-vlrstat="42"><option>Confirmed</option></select><select data-w119mv="42"><option>Move</option><option value="driver">Driver</option></select></div>' +
    '<div class="c">alex@example.invalid</div><span class="w171tag">Confirmed by Sam</span><span class="w171tag">Cooking: vegetable curry</span><button data-w119rm="42">Remove</button></div>' +
    '</div></div></div></section></div></section>', '#volunteering/e/123', [part('serving.js')], window => {
      originalMove = window.document.querySelector('[data-w119mv]');
    });
  t.after(() => context.dom.window.close());
  assert.equal(context.document.querySelector('#w119').classList.contains('wa-serving-workspace'), true);
  assert.equal(context.document.querySelector('[data-w119bench="cook"]').hidden, true);
  assert.equal(context.document.querySelector('[data-w119bench="driver"]').hidden, false);
  assert.match(context.document.querySelector('.wa-confirmation').textContent, /Confirmed by Sam/);
  assert.match(context.document.querySelector('.wa-recipe').textContent, /vegetable curry/);
  const toggle = context.document.querySelector('.wa-role-toggle');
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  context.document.querySelector('.wa-contact-trigger').click();
  const panel = context.document.querySelector('.wa-contact-panel');
  assert.equal(panel.hidden, false);
  assert.match(panel.textContent, /alex@example.invalid/);
  assert.equal(panel.querySelector('[data-w119mv]'), originalMove);
  assert.equal(panel.querySelector('[data-w119rm]').textContent, 'Remove from this serving');
  assert.doesNotMatch(panel.textContent, /Sample workspace/);
});
