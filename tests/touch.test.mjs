import assert from 'node:assert/strict';
import test from 'node:test';
import { harness } from './tuning-harness.mjs';

test('touch acquires at 6px without following the finger, crossing 48px starts immediately once', t => {
  const h = harness(t, { flickEnabled: false }), text = h.element('p', {}, h.cards[0]);
  assert.equal(h.down({ target: text }).defaultPrevented, false); h.move({ target: text, clientY: 395, timeStamp: 10 }); assert.equal(h.captures.size, 0);
  assert.equal(h.move({ target: text, clientY: 394, timeStamp: 20 }).defaultPrevented, true); assert.equal(h.captures.size, 1); assert.equal(h.deck.position, 0);
  h.move({ target: text, clientY: 353, timeStamp: 100 }); assert.equal(h.deck.state, 'idle');
  h.move({ target: text, clientY: 352, timeStamp: 120 }); assert.equal(h.deck.state, 'settling'); assert.equal(h.deck.requestedIndex, 1); assert.equal(h.deck.position, 0);
  h.tick(400); h.move({ target: text, clientY: 150, timeStamp: 520 }); assert.deepEqual(h.requests, [1]); h.up({ target: text, clientY: 150, timeStamp: 540 }); h.drain(); h.clean();
});
test('early rejected gesture stays consumed beyond gate opening until pointerup', t => {
  const h = harness(t, {}, true); h.deck.navigate(1); h.down(); h.move({ clientY: 350, timeStamp: 20 }); assert.equal(h.deck.lastRejection, 'gate');
  h.advance(500); h.move({ clientY: 100, timeStamp: 520 }); h.up({ clientY: 100, timeStamp: 540 }); assert.equal(h.deck.index, 1); assert.deepEqual(h.requests, [1]);
  h.down({ pointerId: 2 }); h.move({ pointerId: 2, clientY: 350, timeStamp: 560 }); assert.equal(h.deck.index, 2); h.up({ pointerId: 2 }); h.clean();
});
test('flick minimum, velocity threshold, enable flag and pointerup final sample are independent', t => {
  const h = harness(t, { gate: 0 }, true);
  h.down(); h.move({ clientY: 385, timeStamp: 10 }); assert.equal(h.deck.index, 0); h.up({ clientY: 384, timeStamp: 20 }); assert.equal(h.deck.index, 1);
  h.down(); h.move({ clientY: 384, timeStamp: 100 }); h.up({ clientY: 384, timeStamp: 150 }); assert.equal(h.deck.index, 1);
  h.tuning.flickEnabled = false; h.down(); h.up({ clientY: 384, timeStamp: 20 }); assert.equal(h.deck.index, 1);
  h.down(); h.up({ clientY: 352, timeStamp: 30 }); assert.equal(h.deck.index, 2); h.clean();
});
test('pointer cancellation and second contact only end recognition after accepted command', t => {
  const h = harness(t); h.down(); h.move({ clientY: 350, timeStamp: 20 }); h.dispatch('pointercancel'); assert.equal(h.deck.state, 'settling'); assert.equal(h.captures.size, 0); h.drain(); assert.equal(h.deck.index, 1);
  h.down({ pointerId: 2 }); h.move({ pointerId: 2, clientY: 350, timeStamp: 1000 });
  const outside = h.element('button'); h.down({ target: outside, pointerId: 3, isPrimary: false }); assert.equal(h.captures.size, 0); assert.equal(h.deck.state, 'settling');
  h.up({ pointerId: 2 }); h.down({ pointerId: 4 }); h.move({ pointerId: 4, clientY: 250 }); assert.equal(h.deck.requestedIndex, 2);
  h.up({ pointerId: 4 }); h.up({ target: outside, pointerId: 3 }); h.drain(); h.clean();
});
test('horizontal intent, interactive controls, inactive cards and mouse text retain native input', t => {
  const h = harness(t, {}, true); h.down(); assert.equal(h.move({ clientX: 60, clientY: 389, timeStamp: 10 }).defaultPrevented, false); h.move({ clientY: 200 }); h.up(); assert.equal(h.deck.index, 0);
  for (const target of [h.element('button', {}, h.cards[0]), h.element('span', { role: 'slider' }, h.cards[0]), h.element('div', { contenteditable: 'true' }, h.cards[0]), h.element('p', {}, h.cards[0]), h.cards[1]]) {
    const pointerType = target.tagName === 'P' ? 'mouse' : 'touch'; h.down({ target, pointerType }); h.move({ target, pointerType, clientY: 250 }); h.up({ target, pointerType }); assert.equal(h.deck.index, 0);
  }
  h.down({ pointerType: 'mouse' }); h.move({ pointerType: 'mouse', clientY: 350, timeStamp: 30 }); h.up({ pointerType: 'mouse' }); assert.equal(h.deck.index, 1); h.clean();
});
test('intentional hold releases selection at 350ms, acquisition survives deadline and outside end cleans', t => {
  const h = harness(t, { flickEnabled: false }, true); h.down(); h.advance(350); assert.equal(h.move({ clientY: 300 }).defaultPrevented, false); h.up(); h.clean();
  h.down({ timeStamp: 1000 }); assert.equal(h.move({ clientY: 300, timeStamp: 1350 }).defaultPrevented, false); h.up(); h.clean();
  h.down(); assert.equal(h.dispatch('selectstart').defaultPrevented, true); h.move({ clientY: 394, timeStamp: h.now() + 10 }); h.advance(500);
  assert.equal(h.dispatch('selectstart').defaultPrevented, true); h.move({ clientY: 352, timeStamp: h.now() }); assert.equal(h.deck.index, 1);
  h.up({ target: h.element('button') }); h.clean(); assert.equal(h.dispatch('selectstart').defaultPrevented, false);
});
test('hold delay tuning does not change swipe threshold; selection and lifecycle interruption clean candidates', t => {
  const h = harness(t, { holdDelay: 1, flickEnabled: false }, true); h.down(); h.advance(500); h.move({ clientY: 353 }); assert.equal(h.deck.index, 0); h.up({ clientY: 352 }); assert.equal(h.deck.index, 1); h.clean();
  for (const interrupt of [() => h.deck.measure(), () => h.deck.settle(), () => h.blur(), () => h.deck.setEnabled(false)]) { h.down(); interrupt(); h.clean(); h.deck.setEnabled(true); }
  h.down(); h.selection.isCollapsed = false; h.dispatch('selectionchange'); h.up(); h.clean(); assert.equal(h.selection.isCollapsed, false);
});
