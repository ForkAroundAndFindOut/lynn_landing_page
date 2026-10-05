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
  for (const target of [h.element('input', {}, h.cards[0]), h.element('span', { role: 'slider' }, h.cards[0]), h.element('div', { contenteditable: 'true' }, h.cards[0]), h.element('p', {}, h.cards[0]), h.cards[1]]) {
    const pointerType = target.tagName === 'P' ? 'mouse' : 'touch'; h.down({ target, pointerType }); h.move({ target, pointerType, clientY: 250 }); h.up({ target, pointerType }); assert.equal(h.deck.index, 0);
  }
  h.down({ pointerType: 'mouse' }); h.move({ pointerType: 'mouse', clientY: 350, timeStamp: 30 }); h.up({ pointerType: 'mouse' }); assert.equal(h.deck.index, 1); h.clean();
});

test('links and buttons accept full-distance swipes from nested children while taps keep activation', t => {
  const h = harness(t, { gate: 0 }, true);
  for (const tag of ['a', 'button']) {
    const action = h.element(tag, {}, h.cards[h.deck.index]), child = h.element('span', {}, action);
    assert.equal(h.down({ target: child }).defaultPrevented, false);
    assert.equal(h.dispatch('click', { target: child, detail: 1 }).defaultPrevented, false);
    h.up({ target: child });
    h.down({ target: child }); h.move({ target: child, clientY: 384, timeStamp: 10 }); assert.equal(h.requests.length, tag === 'a' ? 0 : 1, 'link/button ignores short flick');
    h.move({ target: child, clientY: 353, timeStamp: 20 }); const before = h.deck.index;
    h.move({ target: child, clientY: 352, timeStamp: 30 }); assert.equal(h.deck.index, before + 1);
    h.up({ target: child, clientY: 352, timeStamp: 40 });
    const click = h.dispatch('click', { target: child, detail: 1, clientY: 352 }); assert.equal(click.defaultPrevented, true); assert.equal(click.propagationStopped, true);
    assert.equal(h.dispatch('click', { target: child, detail: 0 }).defaultPrevented, false);
  }
  const link = h.element('a', {}, h.cards[h.deck.index]), child = h.element('span', {}, link);
  assert.equal(h.down({ target: child, pointerType: 'mouse' }).defaultPrevented, false);
  assert.equal(h.dispatch('dragstart', { target: child }).defaultPrevented, true);
  h.move({ target: child, pointerType: 'mouse', clientY: 352, timeStamp: 20 }); h.up({ target: child, pointerType: 'mouse', clientY: 352 });
  assert.equal(h.deck.index, 3); h.clean();
});

test('gate and boundary swipe rejections suppress only their pointer click, not fresh or keyboard activation', t => {
  const h = harness(t, {}, true), link = h.element('a', {}, h.cards[0]);
  h.down({ target: link }); h.move({ target: link, clientY: 448, timeStamp: 10 }); h.up({ target: link, clientY: 448 });
  assert.equal(h.deck.lastRejection, 'endpoint'); assert.equal(h.dispatch('click', { target: link, detail: 1 }).defaultPrevented, true);
  h.deck.navigate(1); const button = h.element('button', {}, h.cards[1]);
  h.down({ target: button }); h.move({ target: button, clientY: 352, timeStamp: 20 }); h.up({ target: button, clientY: 352 });
  assert.equal(h.deck.lastRejection, 'gate'); assert.equal(h.dispatch('click', { target: button, detail: 0 }).defaultPrevented, false);
  h.down({ target: button }); h.up({ target: button }); assert.equal(h.dispatch('click', { target: button, detail: 1 }).defaultPrevented, false);
  h.clean();
});

test('legacy pointer clicks at press or release coordinates are consumed after a partial link swipe only', t => {
  const h = harness(t), link = h.element('a', {}, h.cards[0]);
  for (const clickY of [400, 380]) {
    h.down({ target: link }); h.move({ target: link, clientY: 380, timeStamp: 10 }); h.up({ target: link, clientY: 380, timeStamp: 20 });
    assert.equal(h.deck.position, 0); assert.equal(h.deck.requestedIndex, 0);
    assert.equal(h.dispatch('click', { target: link, pointerId: undefined, detail: 1, clientY: clickY }).defaultPrevented, true);
  }
  h.down({ target: link }); h.move({ target: link, clientY: 395, timeStamp: 30 }); h.up({ target: link, clientY: 395 });
  assert.equal(h.dispatch('click', { target: link, detail: 1, clientY: 395 }).defaultPrevented, false);
  h.down({ target: link }); h.move({ target: link, clientY: 380, timeStamp: 40 }); h.up({ target: link, clientY: 380 }); h.advance(751);
  assert.equal(h.dispatch('click', { target: link, detail: 1, clientY: 380 }).defaultPrevented, false);
  h.clean();
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
