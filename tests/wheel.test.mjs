import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeck } from '../deck-controller.js';
import { WHEEL, normalizeWheel } from '../wheel-input.js';

function harness(t, reduced = true) {
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
      setAttribute(name, value) { attrs[name] = value; }, removeAttribute(name) { delete attrs[name]; },
      toggleAttribute(name, value) { if (value) attrs[name] = ''; else delete attrs[name]; },
    };
  }
  const stage = Object.assign(element(), { clientHeight: 640, focus() { document.activeElement = this; },
    hasPointerCapture: (key) => captures.has(key), setPointerCapture: (key) => captures.add(key), releasePointerCapture: (key) => captures.delete(key) });
  const cards = Array.from({ length: 6 }, (_, index) => Object.assign(element('article', { class: 'card' }, stage), { id: `card-${index}`, offsetWidth: 358, offsetHeight: 570 }));
  const changes = [];
  const deck = createDeck({ stage, cards, isReduced: () => reduced, isBlocked: () => blocked, onChange: (index, options) => changes.push({ index, ...options }) });
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
    wheel: (deltaY, overrides) => dispatch('wheel', { deltaY, ...overrides }), block: (value) => { blocked = value; }, blur: () => windowListeners.get('blur')() };
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
    h.advance(WHEEL.quiet);
    assert.equal(h.deck.index, 1);
    assert.equal(h.changes.at(-1).focus, false);
    h.wheel(-16); h.advance(WHEEL.quiet); assert.equal(h.deck.index, 0);
    h.clean();
  }
});

test('small jitter returns to origin while a fine pixel stream accumulates deliberate intent', (t) => {
  const h = harness(t);
  h.wheel(3); h.advance(WHEEL.quiet); assert.equal(h.deck.index, 0);
  for (let n = 0; n < 8; n++) { h.wheel(2); h.advance(20); }
  assert.equal(h.deck.position, 0.2);
  h.advance(WHEEL.quiet); assert.equal(h.deck.index, 1); h.clean();
});

test('one burst stays within adjacent cards, discards excess inertia and reverses immediately', (t) => {
  const h = harness(t); h.deck.jump(2);
  for (let n = 0; n < 12; n++) { h.wheel(90); h.advance(30); }
  assert.equal(h.deck.position, 3); assert.equal(h.deck.index, 2);
  h.wheel(-40); assert.equal(h.deck.position, 2.5);
  h.wheel(-40); assert.equal(h.deck.position, 2);
  h.advance(WHEEL.quiet); assert.equal(h.deck.index, 2);
  h.wheel(80); h.wheel(-160); assert.equal(h.deck.position, 1);
  h.advance(WHEEL.quiet); assert.equal(h.deck.index, 1); h.clean();
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

test('inertial tail during settlement never queues another card and must go quiet before reacquiring', (t) => {
  const h = harness(t, false);
  h.wheel(48); h.advance(WHEEL.quiet); assert.equal(h.deck.state, 'settling');
  h.tick();
  for (let n = 0; n < 25; n++) { h.wheel(10); h.tick(20); }
  assert.equal(h.deck.index, 1); assert.equal(h.deck.state, 'idle');
  h.wheel(80); assert.equal(h.deck.position, 1, 'a continuing tail is consumed even after animation finishes');
  h.advance(WHEEL.quiet); h.clean();
  h.wheel(16); h.advance(WHEEL.quiet); h.drain(); assert.equal(h.deck.index, 2); h.clean();
});

test('wheel input arriving during keyboard settlement cannot replay through its navigation queue', (t) => {
  const h = harness(t, false); h.deck.navigate(1); h.tick();
  for (let n = 0; n < 25; n++) { h.wheel(40); h.tick(20); }
  assert.equal(h.deck.index, 1); h.advance(WHEEL.quiet); h.clean();
});

test('boundary inertia stays bounded and reversal retreats without invisible overflow', (t) => {
  const h = harness(t); h.deck.jump(5);
  for (let n = 0; n < 15; n++) h.wheel(300);
  assert.equal(h.deck.position, 5);
  h.wheel(-16); assert.equal(h.deck.position, 4.8);
  h.advance(WHEEL.quiet); assert.equal(h.deck.index, 4); h.clean();
  h.deck.jump(0); h.wheel(-500); h.advance(WHEEL.quiet); assert.equal(h.deck.index, 0); h.clean();
});

test('mode, resize, overlay, visibility, selection and explicit lifecycle interruptions clear wheel work', (t) => {
  const h = harness(t);
  const interruptions = [() => h.deck.settle(), () => h.deck.measure(), () => h.deck.setEnabled(false),
    () => h.deck.jump(0), () => { h.block(true); h.wheel(10); h.block(false); },
    () => { document.hidden = true; h.dispatch('visibilitychange'); document.hidden = false; },
    () => { h.selection.isCollapsed = false; h.dispatch('selectionchange'); h.selection.isCollapsed = true; },
    () => h.dispatch('contextmenu'), () => h.wheel(20, { ctrlKey: true }), () => h.blur()];
  for (const interrupt of interruptions) {
    h.deck.jump(0); h.wheel(20); interrupt(); h.clean();
    h.advance(1000); assert.equal(h.deck.index, 0, 'canceled timers cannot navigate later');
    h.deck.setEnabled(true);
  }
});

test('pointer acquisition cancels wheel timer and wheel cannot steal a pending or acquired drag', (t) => {
  const h = harness(t); h.wheel(20);
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
  h.wheel(20); h.advance(WHEEL.quiet); assert.equal(h.deck.state, 'settling');
  h.wheel(20); h.blur(); h.clean();
  const index = h.deck.index; h.advance(1000); assert.equal(h.deck.index, index);
  h.wheel(20); assert.equal(h.deck.state, 'wheeling'); h.deck.settle(); h.clean();
});
