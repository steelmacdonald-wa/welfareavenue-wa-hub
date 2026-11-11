import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../build/parts130/c_motion.js', import.meta.url), 'utf8');

function preview(options = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><main><section class="panel active"><input></section></main></body></html>',
    { url: 'http://hub.test/#mypage', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const main = window.document.querySelector('main');
  const animations = [];
  const preference = { matches: !!options.reduced, addEventListener(type, listener) { this.change = listener; } };
  window.matchMedia = () => preference;
  main.animate = (frames, timing) => {
    const animation = { frames, timing, playState: 'running', cancel() { this.playState = 'idle'; this.oncancel?.(); } };
    animations.push(animation);
    return animation;
  };
  if (options.unsupported) main.animate = undefined;
  if (!options.loading) window.document.documentElement.classList.add('wa-ready');
  window.eval(source);
  function navigate(hash) {
    const previous = window.location.href;
    window.history.replaceState(null, '', hash);
    window.dispatchEvent(new window.HashChangeEvent('hashchange', { oldURL: previous, newURL: window.location.href }));
  }
  return { dom, window, main, animations, preference, navigate };
}

test('page changes and app subroutes receive one entrance while same-route edits remain still', t => {
  const context = preview();
  t.after(() => context.dom.window.close());
  assert.equal(context.animations.length, 0);
  context.navigate('#volunteering');
  assert.equal(context.animations.length, 1);
  assert.equal(context.animations[0].timing.duration, 300);
  context.navigate('#volunteering/calendar');
  assert.equal(context.animations.length, 2);
  context.navigate('#volunteering/calendar');
  const input = context.main.querySelector('input');
  input.value = 'keep this draft';
  input.focus();
  input.dispatchEvent(new context.window.Event('input', { bubbles: true }));
  context.main.querySelector('section').append('Repainted content');
  assert.equal(context.animations.length, 2);
  assert.equal(input.value, 'keep this draft');
  assert.equal(context.window.document.activeElement, input);
});

test('quick navigation cancels the previous animation and continues from its displayed frame', t => {
  const context = preview();
  t.after(() => context.dom.window.close());
  context.navigate('#calendar');
  context.main.style.opacity = '0.6';
  context.main.style.transform = 'matrix(1, 0, 0, 1, 0, 3)';
  context.navigate('#volunteering');
  assert.equal(context.animations[0].playState, 'idle');
  assert.equal(context.animations[1].frames[0].opacity, '0.6');
  assert.equal(context.animations[1].frames[0].transform, 'matrix(1, 0, 0, 1, 0, 3)');
  context.animations[0].onfinish();
  context.navigate('#mypage');
  assert.equal(context.animations[1].playState, 'idle');
});

test('reduced-motion preferences skip entrances and cancel one already running', t => {
  const context = preview({ reduced: true });
  t.after(() => context.dom.window.close());
  context.navigate('#calendar');
  assert.equal(context.animations.length, 0);
  context.preference.matches = false;
  context.navigate('#mypage');
  assert.equal(context.animations.length, 1);
  context.preference.matches = true;
  context.preference.change();
  assert.equal(context.animations[0].playState, 'idle');
});

test('loading and background pages skip entrances and pagehide releases active motion', t => {
  const context = preview({ loading: true });
  t.after(() => context.dom.window.close());
  context.navigate('#calendar');
  assert.equal(context.animations.length, 0);
  context.window.document.documentElement.classList.add('wa-ready');
  Object.defineProperty(context.window.document, 'hidden', { value: true, configurable: true });
  context.navigate('#volunteering');
  assert.equal(context.animations.length, 0);
  Object.defineProperty(context.window.document, 'hidden', { value: false, configurable: true });
  context.navigate('#volunteering/calendar');
  assert.equal(context.animations.length, 1);
  context.window.dispatchEvent(new context.window.Event('pagehide'));
  assert.equal(context.animations[0].playState, 'idle');
});

test('an unsupported animation API leaves the existing page rendering available', t => {
  const context = preview({ unsupported: true });
  t.after(() => context.dom.window.close());
  context.navigate('#calendar');
  assert.equal(context.animations.length, 0);
  assert.equal(context.window.document.documentElement.classList.contains('wa-smooth-pages'), false);
});
