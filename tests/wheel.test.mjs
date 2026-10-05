import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeWheel, wheelTarget } from '../wheel-input.js';
import { harness } from './tuning-harness.mjs';

test('pixel, line and page wheel units normalize in CSS pixels and malformed values yield', () => {
  assert.deepEqual(normalizeWheel({ deltaX: 2, deltaY: -3, deltaMode: 0 }, 640), { x: 2, y: -3 });
  assert.deepEqual(normalizeWheel({ deltaX: 2, deltaY: -3, deltaMode: 1 }, 640), { x: 32, y: -48 });
  assert.deepEqual(normalizeWheel({ deltaX: 0, deltaY: 1, deltaMode: 2 }, 640), { x: 0, y: 640 });
  assert.equal(normalizeWheel({ deltaY: Infinity }, 640), null);
  assert.equal(wheelTarget(2, 25, 6, 30), 2); assert.equal(wheelTarget(2, 30, 6, 30), 3);
});
test('one wheel command per burst includes endpoint and gate rejections, tails never queue', t => {
  const h = harness(t, {}, true); h.wheel(-16); assert.equal(h.deck.lastRejection, 'endpoint');
  h.wheel(100); assert.equal(h.deck.index, 0); h.advance(400); h.wheel(16); assert.equal(h.deck.index, 1);
  h.tuning.wheelQuiet = 0.1; h.wheel(1); h.advance(100); h.wheel(16); assert.equal(h.deck.lastRejection, 'gate');
  h.advance(200); h.wheel(100); assert.equal(h.deck.index, 2, 'new burst after quiet may request at open gate');
  h.advance(99); h.wheel(-10000); h.advance(99); h.wheel(10000); assert.equal(h.deck.index, 2);
  h.advance(100); h.clean();
});
test('wheel quiet releases independently of animation; new burst retargets with no queued tails', t => {
  const h = harness(t); h.wheel(16); h.tick(400); h.wheel(16);
  assert.equal(h.deck.requestedIndex, 2); h.wheel(10000); h.tick(500); assert.equal(h.deck.requestedIndex, 2);
  h.drain(); assert.equal(h.deck.index, 2); assert.deepEqual(h.requests, [1, 2]); h.advance(400); h.clean();
});
test('wheel threshold and quiet are independent controls and magnitude never changes motion speed', t => {
  const h = harness(t, { wheelThreshold: 30, wheelQuiet: 0.8 });
  h.wheel(29); assert.equal(h.deck.state, 'idle'); h.wheel(1); assert.equal(h.deck.state, 'settling');
  h.tick(400); h.wheel(10000); assert.equal(h.deck.requestedIndex, 1); h.tick(900); h.advance(800);
  h.tuning.wheelThreshold = 3; h.wheel(3); assert.equal(h.deck.requestedIndex, 2); h.tick(900); assert.equal(h.deck.index, 2); h.advance(800); h.clean();
});
test('horizontal, pinch, form controls, selection and nested scrollers retain native behavior', t => {
  const h = harness(t, {}, true), input = h.element('input', {}, h.cards[0]), scroller = h.element('div', {}, h.cards[0]);
  Object.assign(scroller, { scrollHeight: 1000, clientHeight: 200, overflowY: 'auto' });
  for (const overrides of [{ deltaX: 100 }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { target: input }, { target: scroller }]) assert.equal(h.wheel(20, overrides).defaultPrevented, false);
  h.selection.isCollapsed = false; assert.equal(h.wheel(20).defaultPrevented, false); assert.equal(h.deck.index, 0);
  h.selection.isCollapsed = true; const button = h.element('button', {}, h.cards[0]); assert.equal(h.wheel(16, { target: button }).defaultPrevented, true); assert.equal(h.deck.index, 1);
  h.advance(400); h.clean();
});
test('native fragments retain consumed burst lock while lifecycle interruptions remove it', t => {
  const h = harness(t); h.wheel(16); h.tick(200); h.wheel(20, { ctrlKey: true }); h.tick(300); h.wheel(16); assert.equal(h.deck.requestedIndex, 1);
  h.deck.settle(); h.clean(); h.wheel(16); h.blur(); h.clean();
});
