import assert from 'node:assert/strict';
import test from 'node:test';
import { arrivalDirection, evaluatePose, evaluateStack, positionFromTravel, presetFor, releaseTarget, releaseVelocity, travelDistance } from '../motion.js';
import { createDeck } from '../deck-controller.js';

const geometry = { count: 6, width: 358, height: 640, ids: ['intro', 'services', 'process', 'example', 'together', 'contact'] };
const decide = (overrides = {}) => releaseTarget({ position: 2.3, origin: 2, velocity: 0, distance: 120, count: 6, ...overrides });

test('stored left, right, bottom paths end at the same settled center without history drift', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(arrivalDirection), ['left', 'right', 'bottom', 'left', 'right']);
  for (let index = 1; index < 6; index += 1) {
    const pose = evaluatePose({ ...geometry, index, id: geometry.ids[index], progress: 1 });
    assert.equal(pose.x, 0);
    assert.equal(pose.y, 0);
    assert.equal(pose.angle, 0);
    assert.equal(pose.scale, 1);
    const active = evaluateStack({ ...geometry, position: index }).at(-1);
    assert.equal(active.y, 0);
    assert.equal(active.scale, 1);
  }
});

test('forward and reverse evaluation retrace identical translation and rotation', () => {
  const forwards = [0.1, 0.3, 0.6, 0.9].map((progress) => evaluateStack({ ...geometry, position: 2 + progress }));
  const backwards = [0.9, 0.6, 0.3, 0.1].map((progress) => evaluateStack({ ...geometry, position: 2 + progress })).reverse();
  assert.deepEqual(forwards, backwards);
  assert.deepEqual(evaluateStack({ ...geometry, position: 2.41 }), evaluateStack({ ...geometry, position: 2.41 }));
});

test('exposed layers interpolate continuously and painted history stays bounded', () => {
  const resting = evaluateStack({ ...geometry, position: 3 });
  assert.equal(resting.length, 3);
  assert.deepEqual(resting.map(({ y, scale }) => [y, scale]), [[-20, 0.94], [-10, 0.97], [0, 1]]);
  const almost = evaluateStack({ ...geometry, position: 2.999999 });
  assert.ok(almost.length <= 4);
  for (const pose of resting) {
    const preceding = almost.find(({ index }) => index === pose.index);
    assert.ok(Math.abs(preceding.y - pose.y) < 0.001);
    assert.ok(Math.abs(preceding.scale - pose.scale) < 0.000001);
  }
  const first = evaluateStack({ ...geometry, position: 0 });
  assert.equal(first.length, 1);
  assert.equal(first[0].angle, 0);
});

test('gesture travel stops at neighbors and deck boundaries', () => {
  assert.equal(positionFromTravel(0, -600, 120, 6), 0);
  assert.equal(positionFromTravel(5, 600, 120, 6), 5);
  assert.equal(positionFromTravel(2, 600, 120, 6), 3);
  assert.equal(positionFromTravel(2, -600, 120, 6), 1);
  assert.equal(positionFromTravel(2, -30, 120, 6), 1.75);
});

test('slow releases, midpoint ties, and flick projection choose the intended neighbor', () => {
  assert.equal(decide({ position: 2.49 }), 2);
  assert.equal(decide({ position: 2.5 }), 2);
  assert.equal(decide({ position: 2.51 }), 3);
  assert.equal(decide({ position: 1.5 }), 2);
  assert.equal(decide({ position: 1.49 }), 1);
  assert.equal(decide({ position: 2.1, velocity: 0.7 }), 3);
  assert.equal(decide({ position: 2.1, velocity: 0.7, passedDeadZone: false }), 2);
  assert.equal(decide({ position: 0, origin: 0, velocity: -3 }), 0);
  assert.equal(decide({ position: 5, origin: 5, velocity: 3 }), 5);
});

test('the final movement direction overrides an earlier fast forward movement', () => {
  const samples = [{ time: 0, position: 0 }, { time: 20, position: 85 }, { time: 40, position: 95 }, { time: 60, position: 85 }, { time: 80, position: 75 }];
  const velocity = releaseVelocity(samples);
  assert.equal(velocity, -0.5);
  assert.equal(decide({ position: 2.625, velocity }), 2);
  assert.equal(releaseVelocity([...samples, { time: 180, position: 75 }]), 0);
});

test('velocity uses only the final 80ms and supports irregular sampling', () => {
  assert.equal(releaseVelocity([{ time: 0, position: 0 }, { time: 100, position: 100 }]), 1);
  assert.equal(releaseVelocity([{ time: 0, position: 0 }]), 0);
  assert.equal(releaseVelocity([{ time: 0, position: 0 }, { time: 0, position: 20 }]), 0);
});

test('presets preserve direct tracking and bound travel and settlement duration', () => {
  for (const [name, duration, minimum, maximum] of [['crisp', 240, 96, 144], ['balanced', 300, 96, 160], ['gentle', 380, 112, 176]]) {
    assert.equal(presetFor(name).duration, duration);
    assert.equal(travelDistance(100, name), minimum);
    assert.equal(travelDistance(2000, name), maximum);
  }
});

function controllerHarness(t) {
  const original = { document: globalThis.document, window: globalThis.window, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  const callbacks = new Map();
  let nextFrame = 0;
  let time = 0;
  const documentListeners = {};
  globalThis.document = { activeElement: null, hidden: false, addEventListener: (name, listener) => { documentListeners[name] = listener; } };
  globalThis.window = { getSelection: () => ({ isCollapsed: true }) };
  globalThis.requestAnimationFrame = (callback) => { callbacks.set(++nextFrame, callback); return nextFrame; };
  globalThis.cancelAnimationFrame = (frame) => callbacks.delete(frame);
  t.after(() => Object.assign(globalThis, original));
  const cards = Array.from({ length: 6 }, (_, index) => ({
    id: `card-${index}`, offsetWidth: 358, inert: false, attributes: new Map(),
    style: {
      setProperty(name, value) { this[name] = value; },
      removeProperty(name) { delete this[name]; if (!name.startsWith('--')) delete this[name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())]; },
    },
    contains(element) { return element === this; },
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
    toggleAttribute(name, value) { if (value) this.attributes.set(name, ''); else this.attributes.delete(name); },
  }));
  const listeners = {};
  const captures = new Set();
  const stage = {
    clientHeight: 640, dataset: {}, closest: () => null,
    focus() { document.activeElement = this; },
    addEventListener: (name, listener) => { listeners[name] = listener; },
    hasPointerCapture: (pointer) => captures.has(pointer),
    setPointerCapture: (pointer) => captures.add(pointer),
    releasePointerCapture: (pointer) => captures.delete(pointer),
  };
  const changes = [];
  const deck = createDeck({ stage, cards, onChange: (index, options) => changes.push({ index, ...options }) });
  deck.setEnabled(true);
  function tick(milliseconds = 16) {
    time += milliseconds;
    const current = [...callbacks.values()];
    callbacks.clear();
    current.forEach((callback) => callback(time));
  }
  function drain() {
    for (let count = 0; callbacks.size && count < 100; count += 1) tick();
    assert.equal(callbacks.size, 0, 'no idle animation loop should remain');
  }
  function pointer(type, overrides = {}) {
    const event = { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: 50, clientY: 400, timeStamp: time, target: stage, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...overrides };
    listeners[type](event);
    return event;
  }
  return { deck, cards, stage, changes, callbacks, captures, tick, drain, pointer, hide() { document.hidden = true; documentListeners.visibilitychange(); } };
}

test('controller retains one latest request during settlement, without skipping states', (t) => {
  const { deck, changes, drain } = controllerHarness(t);
  deck.navigate(1);
  deck.navigate(1);
  deck.navigate(1);
  deck.navigate(-1);
  drain();
  assert.equal(deck.index, 0);
  assert.equal(deck.state, 'idle');
  assert.deepEqual(changes.map(({ index }) => index), [1, 0]);
});

test('pointer cancellation restores the origin and clears capture and render work', (t) => {
  const { deck, pointer, captures, callbacks } = controllerHarness(t);
  pointer('pointerdown');
  pointer('pointermove', { clientY: 350, timeStamp: 20 });
  assert.equal(deck.state, 'dragging');
  assert.ok(deck.position > 0);
  assert.equal(captures.size, 1);
  pointer('pointercancel', { clientY: 350, timeStamp: 25 });
  assert.equal(deck.position, 0);
  assert.equal(deck.state, 'idle');
  assert.equal(captures.size, 0);
  assert.equal(callbacks.size, 0);
});

test('blank mouse drags suppress native text selection before the dead zone', (t) => {
  const { deck, pointer } = controllerHarness(t);
  const down = pointer('pointerdown', { pointerType: 'mouse' });
  assert.equal(down.defaultPrevented, true);
  pointer('pointermove', { pointerType: 'mouse', clientY: 398, timeStamp: 10 });
  assert.equal(deck.state, 'idle');
  pointer('pointermove', { pointerType: 'mouse', clientY: 370, timeStamp: 20 });
  assert.equal(deck.state, 'dragging');
  pointer('pointercancel');
});

test('text-origin mouse input and blank touch input keep native pointerdown behavior', (t) => {
  const { deck, pointer } = controllerHarness(t);
  const text = pointer('pointerdown', { pointerType: 'mouse', target: { closest: () => ({ tagName: 'P' }) } });
  assert.equal(text.defaultPrevented, false);
  pointer('pointermove', { pointerType: 'mouse', clientY: 370, timeStamp: 20 });
  assert.equal(deck.state, 'idle');
  assert.equal(deck.position, 0);
  assert.equal(pointer('pointerdown', { pointerType: 'touch' }).defaultPrevented, false);
  pointer('pointercancel');
});

test('an interrupted direct jump still reports its selected section', (t) => {
  const { deck, tick, changes, callbacks } = controllerHarness(t);
  deck.jump(5, { contact: true });
  tick();
  tick(100);
  assert.equal(deck.index, 5);
  deck.settle();
  assert.deepEqual(changes.map(({ index }) => index), [5]);
  assert.equal(deck.position, 5);
  assert.equal(callbacks.size, 0);
});

test('tab hiding settles motion, removes temporary hints, and mode exit restores all content', (t) => {
  const { deck, tick, hide, cards, callbacks, stage } = controllerHarness(t);
  document.activeElement = cards[0];
  deck.navigate(1);
  tick();
  tick(120);
  hide();
  assert.equal(deck.index, 1);
  assert.equal(deck.state, 'idle');
  assert.equal(callbacks.size, 0);
  assert.equal(document.activeElement, stage);
  assert.equal(cards[0].inert, true);
  assert.equal(cards[1].inert, false);
  assert.ok(cards.every((card) => !card.style.willChange));
  deck.setEnabled(false);
  assert.ok(cards.every((card) => !card.inert && !card.attributes.has('aria-hidden')));
});
