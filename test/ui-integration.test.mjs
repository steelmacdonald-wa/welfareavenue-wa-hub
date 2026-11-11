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

test('colored status choices dispatch one change through the original roster control', async t => {
  let original, changes = 0;
  const context = await screen('<section id="volunteering"><section id="w191team"><div class="pc"><div class="sel2"><select data-vlrstat="42" aria-label="Status for Alex">' +
    '<option value="TBD">To ask</option><option value="Confirmed">Confirmed</option><option value="Waiting For Response">Waiting</option><option value="Unavailable">Can’t make it</option>' +
    '</select></div></div></section></section>', '#volunteering/e/123', [part('status.js')], window => {
      original = window.document.querySelector('select');
      original.addEventListener('change', () => { changes++; });
    });
  t.after(() => context.dom.window.close());
  const trigger = context.document.querySelector('.wa-status-trigger');
  assert.equal(trigger.dataset.status, 'to-ask');
  trigger.click();
  context.document.querySelector('.wa-status-option[data-value="Confirmed"]').click();
  assert.equal(context.document.querySelector('select'), original);
  assert.equal(original.value, 'Confirmed');
  assert.equal(trigger.dataset.status, 'confirmed');
  assert.equal(changes, 1);
  trigger.click();
  context.document.querySelector('.wa-status-option[data-value="Confirmed"]').click();
  assert.equal(changes, 1);
  original.disabled = true;
  original.dispatchEvent(new context.window.Event('change', { bubbles: true }));
  assert.equal(trigger.disabled, true);
});

test('SOP owner and step menus retain the existing save and edit handlers', async t => {
  let changes = 0, edits = 0;
  const context = await screen('<section id="volunteering"><div class="card"><div id="w191legend"></div>' +
    '<details class="vl-phase" open><summary>Plan the serving</summary><div class="vl-body">' +
    '<div class="vl-step" data-vlstep="tmpl-1"><span class="w191stg">Plan</span><div class="vl-t"><div class="vl-name">Confirm venue <button data-vlmore="1">Details</button></div><div class="vl-det" id="instructions">Instructions</div></div>' +
    '<select data-vlowner="tmpl-1"><option value="">Unassigned</option><option>Alex Example</option></select></div>' +
    '<div class="wa24-sx"><a class="ed" data-w24e="1">Edit</a></div></div></details></div></section>', '#volunteering/sop', [part('sop.js')], window => {
      window.document.querySelector('select').addEventListener('change', () => { changes++; });
      window.document.querySelector('[data-w24e]').addEventListener('click', () => { edits++; });
    });
  t.after(() => context.dom.window.close());
  assert.equal(context.document.querySelectorAll('.wa-sop-stage').length, 6);
  context.document.querySelector('.wa-sop-owner').click();
  context.document.querySelector('.wa-sop-person[data-value="Alex Example"]').click();
  assert.equal(context.document.querySelector('select').value, 'Alex Example');
  assert.equal(changes, 1);
  context.document.querySelector('.wa-sop-edit').click();
  assert.equal(edits, 1);
  assert.match(context.document.querySelector('.wa-sop-title').textContent, /Confirm venue/);
});

test('applicant cards expose name, message and two states with secondary controls in a disclosure', async t => {
  const native = readFileSync(new URL('../build/parts209/a_intake.js', import.meta.url), 'utf8');
  const start = native.indexOf('  function cardHtml(a)');
  const end = native.indexOf('  /* wave258: My roles', start);
  const context = await screen('', '#volunteering/applicants', [part('applicants.js')], window => {
    window.eval("var V={open:{},details:{},notes:{}}; var WA_VOL_PEOPLE=[{id:1,needs_review:true,review_note:'Check references'}]; var STATUS=[['received','To handle'],['welcomed','Welcomed']]; var SOURCES=[['manual','Other']]; function E(v){return String(v??'').replace(/[&<>\"']/g,c=>'&#'+c.charCodeAt(0)+';');} function btn(label,attrs){return '<button '+attrs+'>'+label+'</button>';} function lbl(list,value){return (list.find(row=>row[0]===value)||['',value])[1];} function roleLabel(v){return v;} function ago(){return 'today';} function day(){return 'Nov 10';}");
    window.eval(native.slice(start, end));
    window.document.body.innerHTML = '<ul>' + window.cardHtml({id:2,person_id:1,name:'Alex Example',message:'Available on Sundays',status:'received',roles:['server'],email:'alex@example.invalid',phone:'5550101',source:'manual'}) + '</ul>';
  });
  t.after(() => context.dom.window.close());
  assert.match(context.document.querySelector('.w209hd').textContent, /Alex Example/);
  assert.equal(context.document.querySelector('.w209msg').textContent, 'Available on Sundays');
  assert.match(context.document.querySelector('.wa-app-signals').textContent, /To handle.*Needs review/);
  const details = context.document.querySelector('details');
  assert.equal(details.open, false);
  assert.equal(details.querySelector('a[href^="mailto:"]').textContent, 'alex@example.invalid');
  assert.equal(details.querySelector('[data-w209st]').getAttribute('data-s'), 'welcomed');
  assert.equal(context.document.querySelector('.w209ct').closest('details'), details);
});

test('Phone presentation retains the original composer and call controls', async t => {
  let sends = 0, calls = 0;
  const context = await screen('<section id="volunteering"><div class="card"><div id="w256"><div class="th"><div class="nm">Alex Example</div></div><div class="rp"><textarea data-w256ta>Existing draft</textarea><button data-w256send>Send</button><a href="tel:+15550101" data-w256call>Call</a></div></div></div></section>',
    '#volunteering/phone', [part('phone.js')], window => {
      window.w256 = { state: () => ({ ph: '5550101', inbox: [{ ph: '5550101', wait: true }] }) };
      window.document.querySelector('[data-w256send]').addEventListener('click', () => { sends++; });
      window.document.querySelector('[data-w256call]').addEventListener('click', event => { event.preventDefault(); calls++; });
    });
  t.after(() => context.dom.window.close());
  assert.equal(context.document.querySelector('#w256').classList.contains('wa-phone-workspace'), true);
  assert.equal(context.document.querySelector('textarea').value, 'Existing draft');
  assert.equal(context.document.querySelector('.wa-phone-thread-status').textContent, 'Needs reply');
  context.document.querySelector('[data-w256send]').click();
  context.document.querySelector('[data-w256call]').click();
  assert.equal(sends, 1);
  assert.equal(calls, 1);
});

test('Sign-offs expands the existing request workspace with its original request actions', async t => {
  let opened = 0;
  const context = await screen('<section id="volunteering"><div class="card"><div id="w195"><button class="w195row" data-request="42">Review letter</button></div></div></section>',
    '#volunteering/signoffs', [part('signoffs.js')], window => {
      window.document.querySelector('button').addEventListener('click', () => { opened++; });
    });
  t.after(() => context.dom.window.close());
  assert.equal(context.document.querySelector('#w195').classList.contains('wa-signoffs-workspace'), true);
  assert.equal(context.document.querySelector('.card').classList.contains('wa-signoffs-card'), true);
  context.document.querySelector('button').click();
  assert.equal(opened, 1);
});
