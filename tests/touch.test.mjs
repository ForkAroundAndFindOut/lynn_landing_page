import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeck } from '../deck-controller.js';

function touchHarness(t) {
  const names = ['document', 'window', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'];
  const original = Object.fromEntries(names.map((name) => [name, globalThis[name]]));
  t.after(() => Object.assign(globalThis, original));
  const documentListeners = new Map();
  const frames = new Map();
  const timers = new Map();
  const captures = new Set();
  const selection = { isCollapsed: true, removeAllRanges() { assert.fail('native selection must not be cleared'); } };
  let sequence = 0;
  let now = 0;
  globalThis.document = { activeElement: null, hidden: false, addEventListener(name, callback, capture) {
    const listeners = documentListeners.get(name) || [];
    listeners.push({ callback, capture: Boolean(capture) });
    documentListeners.set(name, listeners);
  } };
  globalThis.window = { getSelection: () => selection };
  globalThis.requestAnimationFrame = (callback) => { frames.set(++sequence, callback); return sequence; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  globalThis.setTimeout = (callback, delay) => { timers.set(++sequence, { callback, at: now + delay }); return sequence; };
  globalThis.clearTimeout = (id) => timers.delete(id);

  function element(tag = 'div', attrs = {}, parent = null) {
    const classes = new Set((attrs.class || '').split(' ').filter(Boolean));
    const node = {
      tagName: tag.toUpperCase(), parent, attrs, listeners: new Map(), dataset: {},
      classList: { add: (value) => classes.add(value), remove: (value) => classes.delete(value), contains: (value) => classes.has(value) },
      style: { setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; } },
      setAttribute(name, value) { this.attrs[name] = value; },
      removeAttribute(name) { delete this.attrs[name]; },
      toggleAttribute(name, value) { if (value) this.attrs[name] = ''; else delete this.attrs[name]; },
      contains(candidate) { for (let current = candidate; current; current = current.parent) if (current === this) return true; return false; },
      closest(selector) {
        for (let current = this; current; current = current.parent) {
          if (selector.split(',').some((part) => {
            const value = part.trim();
            if (value.startsWith('.')) return current.classList.contains(value.slice(1));
            const attribute = value.match(/^\[([^=\]]+)(?:="([^"]+)")?\]$/);
            if (attribute) return attribute[1] in current.attrs && (attribute[2] === undefined || current.attrs[attribute[1]] === attribute[2]);
            return current.tagName.toLowerCase() === value;
          })) return current;
        }
        return null;
      },
      addEventListener(name, callback) { const listeners = this.listeners.get(name) || []; listeners.push(callback); this.listeners.set(name, listeners); },
    };
    return node;
  }
  const stage = element('div', { class: 'deck-stage' });
  Object.assign(stage, {
    clientHeight: 640, focus() { document.activeElement = this; },
    hasPointerCapture: (id) => captures.has(id),
    setPointerCapture: (id) => captures.add(id),
    releasePointerCapture: (id) => captures.delete(id),
  });
  const cards = Array.from({ length: 6 }, (_, index) => Object.assign(element('article', { class: 'card' }, stage), {
    id: `card-${index}`, offsetWidth: 358, offsetHeight: 570,
  }));
  const text = element('p', {}, cards[0]);
  const nestedText = element('strong', {}, text);
  const outside = element('button');
  const changes = [];
  let blocked = false;
  const deck = createDeck({ stage, cards, isBlocked: () => blocked, isReduced: () => true, onChange: (index) => changes.push(index) });
  deck.setEnabled(true);
  function dispatch(name, overrides = {}) {
    const event = { target: nestedText, pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1,
      clientX: 50, clientY: 400, timeStamp: now, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...overrides };
    const listeners = documentListeners.get(name) || [];
    listeners.filter(({ capture }) => capture).forEach(({ callback }) => callback(event));
    if (stage.contains(event.target)) (stage.listeners.get(name) || []).forEach((callback) => callback(event));
    listeners.filter(({ capture }) => !capture).forEach(({ callback }) => callback(event));
    return event;
  }
  function advance(milliseconds, runTimers = true) {
    now += milliseconds;
    if (runTimers) for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
  }
  const down = (overrides) => dispatch('pointerdown', overrides);
  const move = (overrides) => dispatch('pointermove', { clientY: 350, timeStamp: now + 20, ...overrides });
  const up = (overrides) => dispatch('pointerup', { clientY: 260, timeStamp: now + 120, ...overrides });
  function clean() {
    assert.equal(deck.state, 'idle');
    assert.equal(captures.size, 0);
    assert.equal(timers.size, 0);
    assert.equal(frames.size, 0);
    assert.equal(stage.classList.contains('is-deck-dragging'), false);
  }
  return { deck, stage, cards, text, nestedText, outside, selection, captures, frames, timers, changes, element,
    dispatch, advance, down, move, up, clean, block(value) { blocked = value; } };
}

test('touch starts on active nested text without canceling down or explicit capture, and finger up advances', (t) => {
  const h = touchHarness(t);
  assert.equal(h.down().defaultPrevented, false);
  assert.equal(h.captures.size, 0);
  assert.equal(h.timers.size, 1);
  h.move({ clientY: 395 });
  assert.equal(h.deck.state, 'idle');
  assert.equal(h.move({ clientY: 394 }).defaultPrevented, true);
  assert.equal(h.deck.state, 'dragging');
  assert.equal(h.timers.size, 0);
  h.advance(400);
  assert.equal(h.deck.state, 'dragging', 'an acquired drag must survive the hold deadline');
  h.up({ timeStamp: 500 });
  assert.equal(h.deck.index, 1);
  h.clean();
});

test('horizontal intent yields at the existing 1.2 vertical ratio and cannot reacquire', (t) => {
  const h = touchHarness(t);
  h.down();
  const move = h.move({ clientX: 60, clientY: 389 });
  assert.equal(move.defaultPrevented, false);
  h.move({ clientY: 250 });
  assert.equal(h.deck.position, 0);
  h.up();
  h.clean();
});

test('nested controls, interactive roles, editables, no-drag regions and inactive cards retain native input', (t) => {
  const h = touchHarness(t);
  const candidates = ['a', 'button', 'input', 'textarea', 'select', 'summary', 'label'].map((tag) => h.element(tag, {}, h.cards[0]));
  for (const role of ['button', 'link', 'checkbox', 'combobox', 'listbox', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'slider', 'spinbutton', 'switch', 'tab', 'textbox', 'treeitem']) candidates.push(h.element('div', { role }, h.cards[0]));
  candidates.push(h.element('div', { contenteditable: 'true' }, h.cards[0]), h.element('div', { 'data-no-drag': '' }, h.cards[0]), h.cards[1]);
  for (const parent of candidates) {
    const target = h.element('span', {}, parent);
    assert.equal(h.down({ target }).defaultPrevented, false);
    assert.equal(h.move({ target }).defaultPrevented, false);
    h.up({ target });
    assert.equal(h.deck.index, 0);
    h.clean();
  }
});

test('mouse text remains selectable while blank mouse dragging still suppresses selection at down', (t) => {
  const h = touchHarness(t);
  assert.equal(h.down({ pointerType: 'mouse' }).defaultPrevented, false);
  h.move({ pointerType: 'mouse' });
  assert.equal(h.deck.state, 'idle');
  assert.equal(h.down({ pointerType: 'mouse', target: h.cards[0] }).defaultPrevented, true);
  h.move({ pointerType: 'mouse', target: h.cards[0] });
  assert.equal(h.deck.state, 'dragging');
  h.dispatch('pointercancel', { pointerType: 'mouse' });
  h.clean();
});

test('the 350 ms timer yields to long press and later motion cannot acquire that contact', (t) => {
  const h = touchHarness(t);
  h.down();
  h.advance(350);
  h.move({ clientY: 200 });
  assert.equal(h.deck.position, 0);
  h.up();
  h.clean();
});

test('event timestamps enforce the hold deadline even when the timer callback is delayed', (t) => {
  const h = touchHarness(t);
  h.down({ timeStamp: 1000 });
  assert.equal(h.move({ timeStamp: 1350 }).defaultPrevented, false);
  h.move({ timeStamp: 1360, clientY: 150 });
  h.up({ timeStamp: 1370 });
  assert.equal(h.deck.index, 0);
  h.clean();
});

test('native selection and context menu yield without clearing or suppressing pending selection', (t) => {
  const h = touchHarness(t);
  for (const name of ['selectstart', 'selectionchange', 'contextmenu']) {
    h.down();
    if (name === 'selectionchange') h.selection.isCollapsed = false;
    assert.equal(h.dispatch(name).defaultPrevented, false);
    h.move();
    assert.equal(h.deck.state, 'idle');
    if (name === 'selectionchange') assert.equal(h.selection.isCollapsed, false);
    h.up();
    h.clean();
    h.selection.isCollapsed = true;
  }
  h.selection.isCollapsed = false;
  h.down();
  h.move();
  h.up();
  h.clean();
});

test('an acquired drag suppresses selectstart only inside the stage and releases the scope on completion', (t) => {
  const h = touchHarness(t);
  h.down();
  h.move();
  assert.equal(h.stage.classList.contains('is-deck-dragging'), true);
  assert.equal(h.dispatch('selectstart').defaultPrevented, true);
  assert.equal(h.dispatch('selectstart', { target: h.outside }).defaultPrevented, false);
  h.up();
  h.clean();
  assert.equal(h.dispatch('selectstart').defaultPrevented, false);
});

test('descendant implicit capture loss does not cancel capture transfer, genuine stage loss restores the origin', (t) => {
  const h = touchHarness(t);
  h.down();
  h.move();
  h.dispatch('lostpointercapture', { target: h.nestedText });
  assert.equal(h.deck.state, 'dragging');
  h.dispatch('lostpointercapture', { target: h.stage, pointerId: 2 });
  assert.equal(h.deck.state, 'dragging');
  h.captures.delete(1);
  h.dispatch('lostpointercapture', { target: h.stage });
  assert.equal(h.deck.position, 0);
  h.up();
  h.clean();
});

test('second touch anywhere, even a non-primary control, cancels before guards and blocks until every contact ends', (t) => {
  const h = touchHarness(t);
  h.deck.jump(2);
  h.down({ target: h.cards[2] });
  h.move({ target: h.cards[2] });
  assert.ok(h.deck.position > 2);
  const second = h.down({ target: h.outside, pointerId: 2, isPrimary: false });
  assert.equal(second.defaultPrevented, false);
  assert.equal(h.deck.position, 2);
  h.clean();
  h.up({ target: h.cards[2], pointerId: 1 });
  h.down({ target: h.cards[2], pointerId: 3 });
  h.move({ target: h.cards[2], pointerId: 3 });
  assert.equal(h.deck.state, 'idle');
  h.up({ target: h.outside, pointerId: 2 });
  h.down({ target: h.cards[2], pointerId: 4 });
  h.move({ target: h.cards[2], pointerId: 4 });
  assert.equal(h.deck.state, 'idle', 'remaining third contact keeps acquisition blocked');
  h.up({ target: h.cards[2], pointerId: 3 });
  h.up({ target: h.cards[2], pointerId: 4 });
  h.down({ target: h.cards[2], pointerId: 5 });
  h.move({ target: h.cards[2], pointerId: 5 });
  assert.equal(h.deck.state, 'dragging');
  h.up({ target: h.cards[2], pointerId: 5 });
  assert.equal(h.deck.index, 3);
  h.clean();
});

test('every interruption clears timer, capture, selection scope and pending render work', (t) => {
  const h = touchHarness(t);
  const interruptions = [
    () => h.dispatch('pointercancel'),
    () => h.dispatch('contextmenu'),
    () => h.deck.settle(),
    () => h.deck.measure(),
    () => h.deck.jump(h.deck.index),
    () => h.deck.setEnabled(false),
    () => { h.block(true); h.move(); h.block(false); },
    () => { document.hidden = true; h.dispatch('visibilitychange'); document.hidden = false; },
  ];
  for (const interrupt of interruptions) for (const acquired of [false, true]) {
    h.down();
    if (acquired) h.move();
    interrupt();
    h.up();
    h.clean();
    h.deck.setEnabled(true);
  }
});

test('pending touch ending outside the stage and pending pointerleave both clear the hold timer', (t) => {
  const h = touchHarness(t);
  h.down();
  h.up({ target: h.outside });
  h.clean();
  h.down();
  h.dispatch('pointerleave');
  h.up();
  h.clean();
});

test('navigation clears a pending touch candidate and downward dragging returns to the previous card', (t) => {
  const h = touchHarness(t);
  h.down();
  h.deck.navigate(1);
  h.move();
  h.up();
  assert.equal(h.deck.index, 1);
  h.clean();
  const target = h.element('p', {}, h.cards[1]);
  h.down({ target });
  h.move({ target, clientY: 450 });
  assert.ok(h.deck.position < 1);
  h.up({ target, clientY: 540 });
  assert.equal(h.deck.index, 0);
  h.clean();
});
