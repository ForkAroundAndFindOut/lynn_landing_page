import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeck } from '../deck-controller.js';
import { WHEEL, normalizeWheel } from '../wheel-input.js';

function harness(t, reduced = true, preset = 'balanced') {
  const names = ['document', 'window', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'];
  const original = Object.fromEntries(names.map((name) => [name, globalThis[name]]));
  t.after(() => Object.assign(globalThis, original));
  const documentListeners = new Map(), frames = new Map(), timers = new Map(), captures = new Set();
  const selection = { isCollapsed: true };
  let id = 0, now = 0, blocked = false;
  globalThis.document = { activeElement: null, hidden: false, addEventListener(name, fn, capture) {
    const list = documentListeners.get(name) || []; list.push({ fn, capture }); documentListeners.set(name, list);
  } };
  const windowListeners = new Map();
  globalThis.window = { getSelection: () => selection, getComputedStyle: (node) => ({ overflowY: node.overflowY || 'visible' }),
    addEventListener: (name, fn) => windowListeners.set(name, fn) };
  globalThis.requestAnimationFrame = (fn) => { frames.set(++id, fn); return id; };
  globalThis.cancelAnimationFrame = (key) => frames.delete(key);
  globalThis.setTimeout = (fn, delay) => { timers.set(++id, { fn, due: now + delay }); return id; };
  globalThis.clearTimeout = (key) => timers.delete(key);
  function element(tag = 'div', attrs = {}, parentElement = null) {
    const classes = new Set((attrs.class || '').split(' '));
    return { tagName: tag.toUpperCase(), attrs, parentElement, dataset: {}, listeners: new Map(),
      style: { setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; } },
      classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
      contains(candidate) { for (let node = candidate; node; node = node.parentElement) if (node === this) return true; return false; },
      closest(selector) {
        for (let node = this; node; node = node.parentElement) if (selector.split(',').some((part) => {
          const value = part.trim(), attribute = value.match(/^\[([^=\]]+)(?:="([^"]+)")?\]$/);
          if (value.startsWith('.')) return (node.attrs.class || '').split(' ').includes(value.slice(1));
          if (attribute) return attribute[1] in node.attrs && (attribute[2] === undefined || node.attrs[attribute[1]] === attribute[2]);
          return node.tagName.toLowerCase() === value;
        })) return node;
        return null;
      },
      addEventListener(name, fn, options) { const list = this.listeners.get(name) || []; list.push({ fn, options }); this.listeners.set(name, list); },
      removeEventListener(name, fn) { this.listeners.set(name, (this.listeners.get(name) || []).filter((listener) => listener.fn !== fn)); },
      setAttribute(name, value) { attrs[name] = value; }, removeAttribute(name) { delete attrs[name]; },
      toggleAttribute(name, value) { if (value) attrs[name] = ''; else delete attrs[name]; },
    };
  }
  const stage = Object.assign(element(), { clientHeight: 640, focus() { document.activeElement = this; },
    hasPointerCapture: (key) => captures.has(key), setPointerCapture: (key) => captures.add(key), releasePointerCapture: (key) => captures.delete(key) });
  const cards = Array.from({ length: 6 }, (_, index) => Object.assign(element('article', { class: 'card' }, stage), { id: `card-${index}`, offsetWidth: 358, offsetHeight: 570 }));
  const changes = [];
  const deck = createDeck({ stage, cards, getPreset: () => preset, isReduced: () => reduced, isBlocked: () => blocked, onChange: (index, options) => changes.push({ index, ...options }) });
  deck.setEnabled(true);
  function dispatch(name, overrides = {}) {
    const event = { target: cards[deck.index], deltaX: 0, deltaY: 0, deltaMode: 0, timeStamp: now,
      pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1, clientX: 50, clientY: 400,
      defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...overrides };
    const list = documentListeners.get(name) || [];
    list.filter(({ capture }) => capture).forEach(({ fn }) => fn(event));
    if (stage.contains(event.target)) (stage.listeners.get(name) || []).forEach(({ fn }) => fn(event));
    list.filter(({ capture }) => !capture).forEach(({ fn }) => fn(event));
    return event;
  }
  function advance(ms) {
    now += ms;
    for (const [key, timer] of [...timers]) if (timer.due <= now) { timers.delete(key); timer.fn(); }
  }
  function tick(ms = 16) { advance(ms); const list = [...frames.values()]; frames.clear(); list.forEach((fn) => fn(now)); }
  function drain() { for (let n = 0; frames.size && n < 100; n++) tick(); assert.equal(frames.size, 0); }
  function clean() { assert.equal(timers.size, 0); assert.equal(frames.size, 0); assert.equal(captures.size, 0); assert.equal(deck.state, 'idle'); }
  return { deck, stage, cards, changes, selection, timers, frames, element, dispatch, advance, tick, drain, clean,
    wheel: (deltaY, overrides) => dispatch('wheel', { deltaY, ...overrides }), block: (value) => { blocked = value; },
    setPreset: (value) => { preset = value; }, blur: () => windowListeners.get('blur')() };
}

test('pixel, line and page wheel units normalize in CSS pixels and malformed deltas yield', () => {
  assert.deepEqual(normalizeWheel({ deltaX: 2, deltaY: -3, deltaMode: 0 }, 640), { x: 2, y: -3 });
  assert.deepEqual(normalizeWheel({ deltaX: 2, deltaY: -3, deltaMode: 1 }, 640), { x: 32, y: -48 });
  assert.deepEqual(normalizeWheel({ deltaX: 0, deltaY: 1, deltaMode: 2 }, 640), { x: 0, y: 640 });
  assert.equal(normalizeWheel({ deltaY: Infinity }, 640), null);
});

test('a one-line notch and equivalent pixel/page intent advance, then negative input retreats without focusing', (t) => {
  const h = harness(t);
  assert.equal(h.stage.listeners.get('wheel')[0].options.passive, false);
  for (const [deltaY, deltaMode] of [[1, 1], [16, 0], [1, 2]]) {
    assert.equal(h.wheel(deltaY, { deltaMode }).defaultPrevented, true);
    assert.equal(h.deck.index, 1, 'commit starts navigation immediately');
    h.advance(WHEEL.quiet);
    assert.equal(h.changes.at(-1).focus, false);
    h.wheel(-16); h.advance(WHEEL.quiet); assert.equal(h.deck.index, 0);
    h.clean();
  }
});

test('small jitter never moves cards while a fine pixel stream accumulates one command', (t) => {
  const h = harness(t);
  h.wheel(3); h.advance(WHEEL.quiet); assert.equal(h.deck.index, 0);
  for (let n = 0; n < 7; n++) { h.wheel(2); h.advance(20); assert.equal(h.deck.position, 0); assert.equal(h.frames.size, 0); }
  h.wheel(2); assert.equal(h.deck.index, 1);
  h.advance(WHEEL.quiet); assert.equal(h.deck.index, 1); h.clean();
});

test('reversal cancels uncommitted intent and cannot alter or repeat a committed command', (t) => {
  const h = harness(t); h.deck.jump(2);
  h.wheel(12); h.wheel(-12); assert.equal(h.deck.position, 2);
  h.advance(WHEEL.quiet); assert.equal(h.deck.index, 2);
  h.wheel(6); h.wheel(-22); assert.equal(h.deck.index, 1);
  for (let n = 0; n < 12; n++) { h.wheel(n % 2 ? 500 : -500); h.advance(30); }
  assert.equal(h.deck.index, 1); h.advance(WHEEL.quiet); h.clean();
});

test('scrolling outside the stage, flow mode, horizontal intent, shifted wheel and zoom stay native', (t) => {
  const h = harness(t);
  for (const overrides of [{ target: h.element() }, { deltaX: 100 }, { shiftKey: true }, { ctrlKey: true }, { metaKey: true }]) {
    assert.equal(h.wheel(40, overrides).defaultPrevented, false); assert.equal(h.deck.position, 0); h.clean();
  }
  h.deck.setEnabled(false); assert.equal(h.wheel(100).defaultPrevented, false); assert.equal(h.deck.index, 0); h.clean();
});

test('passive links/buttons permit wheel but controls, editables, selection and nested scrolling retain native behavior', (t) => {
  const h = harness(t);
  for (const [tag, attrs] of [['a', {}], ['button', {}], ['div', { role: 'link' }], ['div', { role: 'button' }]]) {
    assert.equal(h.wheel(16, { target: h.element('span', {}, h.element(tag, attrs, h.cards[h.deck.index])) }).defaultPrevented, true);
    h.advance(WHEEL.quiet);
  }
  const before = h.deck.index;
  const candidates = ['input', 'textarea', 'select', 'option'].map((tag) => h.element(tag, {}, h.cards[before]));
  for (const role of ['slider', 'spinbutton', 'textbox', 'combobox', 'listbox', 'tree']) candidates.push(h.element('div', { role }, h.cards[before]));
  for (const attr of ['contenteditable', 'data-no-drag', 'data-no-wheel']) candidates.push(h.element('div', { [attr]: '' }, h.cards[before]));
  for (const overflowY of ['auto', 'scroll', 'overlay']) candidates.push(Object.assign(h.element('div', {}, h.cards[before]), { overflowY, clientHeight: 40, scrollHeight: 100, scrollTop: 60 }));
  for (const candidate of candidates) {
    assert.equal(h.wheel(100, { target: h.element('span', {}, candidate) }).defaultPrevented, false); assert.equal(h.deck.index, before); h.clean();
  }
  h.selection.isCollapsed = false; assert.equal(h.wheel(100).defaultPrevented, false); h.clean();
});

test('inertial tails with 180–350ms gaps never queue another card even after animation finishes', (t) => {
  const h = harness(t, false);
  h.wheel(48); assert.equal(h.deck.state, 'settling'); h.tick(); h.tick(700); h.wheel(48); h.tick(200);
  assert.equal(h.deck.index, 1); assert.equal(h.deck.state, 'idle');
  for (const gap of [180, 250, 350, 180, 350]) {
    // The first event continues the original burst, subsequent gaps remain
    // longer than the former 180 ms timeout but shorter than true quiet.
    h.wheel(300); h.advance(gap); h.wheel(-300); assert.equal(h.deck.position, 1);
  }
  assert.deepEqual(h.changes.map(({ index }) => index), [1]);
  h.advance(WHEEL.quiet); h.clean();
  h.wheel(16); h.drain(); assert.equal(h.deck.index, 2); h.advance(WHEEL.quiet); h.clean();
});

test('wheel input arriving during keyboard settlement cannot replay through its navigation queue', (t) => {
  const h = harness(t, false); h.deck.navigate(1); h.tick();
  for (let n = 0; n < 25; n++) { h.wheel(40); h.tick(20); }
  h.drain(); assert.equal(h.deck.index, 1); h.advance(WHEEL.quiet); h.clean();
});

test('boundary command consumes its entire burst, including reversal, before a new command can retreat', (t) => {
  const h = harness(t); h.deck.jump(5);
  for (let n = 0; n < 15; n++) h.wheel(300);
  assert.equal(h.deck.position, 5);
  h.wheel(-16); assert.equal(h.deck.position, 5);
  h.advance(WHEEL.quiet); h.wheel(-16); assert.equal(h.deck.index, 4);
  h.advance(WHEEL.quiet); h.clean();
  h.deck.jump(0); h.wheel(-500); h.advance(WHEEL.quiet); assert.equal(h.deck.index, 0); h.clean();
});

test('mode, resize, overlay, visibility, selection and explicit lifecycle interruptions clear wheel work', (t) => {
  const h = harness(t);
  const interruptions = [() => h.deck.settle(), () => h.deck.measure(), () => h.deck.setEnabled(false),
    () => h.deck.jump(0), () => { h.block(true); h.wheel(10); h.block(false); },
    () => { document.hidden = true; h.dispatch('visibilitychange'); document.hidden = false; },
    () => { h.selection.isCollapsed = false; h.dispatch('selectionchange'); h.selection.isCollapsed = true; },
    () => h.dispatch('contextmenu'), () => h.blur()];
  for (const interrupt of interruptions) {
    h.deck.jump(0); h.wheel(10); interrupt(); h.clean();
    h.advance(1000); assert.equal(h.deck.index, 0, 'canceled timers cannot navigate later');
    h.deck.setEnabled(true);
  }
});

test('pointer acquisition cancels wheel timer and wheel cannot steal a pending or acquired drag', (t) => {
  const h = harness(t); h.wheel(10);
  h.dispatch('pointerdown', { pointerType: 'touch' });
  assert.equal(h.wheel(50).defaultPrevented, false);
  h.dispatch('pointermove', { pointerType: 'touch', clientY: 350 });
  assert.equal(h.deck.state, 'dragging');
  const position = h.deck.position;
  assert.equal(h.wheel(50).defaultPrevented, false); assert.equal(h.deck.position, position);
  h.dispatch('pointercancel', { pointerType: 'touch' }); h.advance(1000); h.clean(); assert.equal(h.deck.index, 0);
});

test('explicit navigation interrupts owned wheel input while settlement and guards reset on blur', (t) => {
  const h = harness(t, false);
  h.wheel(20); h.deck.navigate(1); h.drain(); assert.equal(h.deck.index, 1); h.clean();
  h.wheel(20); assert.equal(h.deck.state, 'settling');
  h.wheel(20); h.blur(); h.clean();
  const index = h.deck.index; h.advance(1000); assert.equal(h.deck.index, index);
  h.wheel(20); assert.equal(h.deck.state, 'settling'); h.deck.settle(); h.clean();
});

test('wheel listener is attached only in deck mode and repeated mode refresh never duplicates it', (t) => {
  const h = harness(t);
  assert.equal(h.stage.listeners.get('wheel').length, 1);
  h.deck.setEnabled(true); assert.equal(h.stage.listeners.get('wheel').length, 1);
  h.wheel(10); h.deck.setEnabled(false); assert.equal(h.stage.listeners.get('wheel').length, 0); h.clean();
  assert.equal(h.wheel(100).defaultPrevented, false);
  h.deck.setEnabled(true); assert.equal(h.stage.listeners.get('wheel').length, 1);
  h.deck.setEnabled(false); h.deck.setEnabled(true); assert.equal(h.stage.listeners.get('wheel').length, 1); h.clean();
});

test('delta magnitude and stream speed never change the complete preset animation or leave partial cards', (t) => {
  const h = harness(t, false);
  for (const [preset, duration] of [['crisp', 600], ['balanced', 900], ['gentle', 1300]]) {
    h.setPreset(preset);
    for (const magnitude of [16, 48, 8000]) {
      h.deck.jump(0); h.drain(); h.changes.length = 0;
      h.wheel(magnitude); assert.equal(h.deck.position, 0, 'wheel handler never manually assigns fractional progress');
      assert.equal(h.deck.state, 'settling'); h.tick(); h.tick(duration / 2);
      assert.equal(h.deck.position, 0.875, 'progress is the preset easeOut at half duration');
      h.wheel(-8000); h.tick(duration / 2 - 1); assert.equal(h.deck.index, 0);
      h.tick(1); assert.equal(h.deck.position, 1); assert.equal(h.deck.index, 1);
      assert.deepEqual(h.changes.map(({ index }) => index), [1]); h.advance(WHEEL.quiet); h.clean();
    }
    h.deck.jump(0); h.drain(); h.changes.length = 0;
    for (let n = 0; n < 7; n++) { h.wheel(2); h.advance(40); assert.equal(h.deck.position, 0); }
    h.wheel(2); h.tick(); h.tick(duration); assert.equal(h.deck.index, 1);
    assert.deepEqual(h.changes.map(({ index }) => index), [1]); h.advance(WHEEL.quiet); h.clean();
  }
});

test('quiet during a paused animation does not unlock another command until that animation finishes', (t) => {
  const h = harness(t, false); h.wheel(16); h.advance(WHEEL.quiet);
  assert.equal(h.deck.state, 'settling'); h.wheel(500); h.drain(); assert.equal(h.deck.index, 1);
  assert.equal(h.deck.state, 'idle');
  h.wheel(500); assert.equal(h.deck.state, 'settling', 'quiet already elapsed while the slow animation ran');
  h.drain(); assert.equal(h.deck.index, 2); h.advance(WHEEL.quiet); h.clean();
});

test('horizontal, zoom and native control fragments preserve committed animation and burst lock', (t) => {
  const h = harness(t, false); h.wheel(16); h.tick();
  const input = h.element('input', {}, h.cards[0]);
  for (const overrides of [{ deltaX: 100 }, { ctrlKey: true }, { metaKey: true }, { target: input }]) {
    assert.equal(h.wheel(20, overrides).defaultPrevented, false); assert.equal(h.deck.state, 'settling');
  }
  h.tick(750); h.wheel(20, { target: input }); h.tick(150);
  assert.equal(h.deck.index, 1); h.wheel(100); assert.equal(h.deck.state, 'idle', 'recent native fragment preserves burst lock');
  h.advance(WHEEL.quiet); h.clean();
});

test('399 ms of quiet remains locked, while a full 400 ms permits exactly one new command', (t) => {
  const h = harness(t); h.wheel(16); assert.equal(h.deck.index, 1);
  h.advance(399); h.wheel(100); assert.equal(h.deck.index, 1);
  h.advance(399); assert.equal(h.deck.index, 1); h.advance(1);
  h.wheel(16); assert.equal(h.deck.index, 2); h.advance(WHEEL.quiet); h.clean();
});

test('committed animation and its burst lock are canceled cleanly on lifecycle interruption', (t) => {
  const h = harness(t, false);
  const interruptions = [() => h.deck.measure(), () => h.deck.setEnabled(false), () => h.deck.settle(),
    () => { h.block(true); h.wheel(20); h.block(false); },
    () => { document.hidden = true; h.dispatch('visibilitychange'); document.hidden = false; },
    () => h.blur(), () => h.dispatch('pointerdown', { target: h.element('button') })];
  for (const interrupt of interruptions) {
    h.deck.jump(0); h.drain(); h.wheel(16); h.tick(); h.tick(25); interrupt(); h.clean();
    const index = h.deck.index; assert.ok(Number.isInteger(h.deck.position));
    h.advance(1000); assert.equal(h.deck.index, index); h.deck.setEnabled(true);
    h.wheel(16); assert.equal(h.deck.state, 'settling', 'new input can start after explicit cancellation');
    h.deck.settle(); h.clean();
  }
});
