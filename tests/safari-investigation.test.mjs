import assert from 'node:assert/strict';
import test from 'node:test';
import { harness } from './tuning-harness.mjs';

// Characterizations of the current implementation, not desired fix behavior.
test('a consumed burst stays consumed under 100ms momentum even with gate zero', t => {
  const h = harness(t, { gate: 0 }, true);
  h.wheel(16); assert.equal(h.deck.index, 1);
  for (let n = 0; n < 40; n++) { h.advance(100); h.wheel(n % 2 ? -20 : 20); }
  assert.deepEqual(h.requests, [1]); assert.equal(h.deck.gateRemaining, 0);
  h.advance(399); h.wheel(16); assert.deepEqual(h.requests, [1]);
  h.advance(400); h.wheel(16); assert.deepEqual(h.requests, [1, 2]);
  h.advance(400); h.clean();
});

test('a first stroke rejected by the gate consumes its burst and cannot retry inside it', t => {
  const h = harness(t, { gate: .8, wheelQuiet: .4 }, true);
  h.deck.navigate(1); h.advance(100); h.wheel(16);
  assert.equal(h.deck.lastRejection, 'gate');
  for (let n = 0; n < 10; n++) { h.advance(100); h.wheel(16); }
  assert.equal(h.deck.gateRemaining, 0); assert.deepEqual(h.requests, [1]);
  h.advance(400); h.wheel(16); assert.deepEqual(h.requests, [1, 2]);
  h.advance(400); h.clean();
});

test('inactive old-card wheel targets are ignored at idle while the stage accepts them', t => {
  const h = harness(t, { gate: 0 }, true);
  h.wheel(16, { target: h.cards[0] }); h.advance(400);
  const ignored = h.wheel(16, { target: h.cards[0] });
  assert.equal(ignored.defaultPrevented, false); assert.deepEqual(h.requests, [1]);
  const accepted = h.wheel(16, { target: h.stage });
  assert.equal(accepted.defaultPrevented, true); assert.deepEqual(h.requests, [1, 2]);
  h.advance(400); h.clean();
});

test('old-card wheel targets can retarget while settling, before the idle filter applies', t => {
  const h = harness(t, { gate: 0 });
  h.wheel(16, { target: h.cards[0] }); h.tick(400);
  assert.equal(h.deck.state, 'settling');
  h.wheel(16, { target: h.cards[0] }); assert.deepEqual(h.requests, [1, 2]);
  h.drain(); h.advance(400); h.clean();
});

test('accepted touch retargets immediately from sampled position without queuing another finish', t => {
  const h = harness(t, { gate: .3, flickEnabled: false, acceleration: 0, deceleration: 0, magneticStrength: 0 });
  h.deck.navigate(1); h.tick(350);
  const before = h.deck.position;
  h.down(); h.advance(40); h.move({ clientY: 340 }); h.up({ clientY: 340 });
  assert.deepEqual(h.requests, [1, 2]); assert.equal(h.deck.requestedIndex, 2);
  assert.ok(h.deck.position > before); assert.equal(h.changes.length, 0);
  h.drain(); assert.equal(h.deck.index, 2); assert.deepEqual(h.changes.map(c => c.index), [2]); h.clean();
});

test('gate-rejected touch is consumed rather than queued after gate expiry', t => {
  const h = harness(t, { gate: .8, flickEnabled: false });
  h.deck.navigate(1); h.tick(100); h.down(); h.advance(40); h.move({ clientY: 340 });
  assert.equal(h.deck.lastRejection, 'gate'); h.tick(800); h.move({ clientY: 280 }); h.up({ clientY: 280 });
  h.drain(); assert.deepEqual(h.requests, [1]); assert.equal(h.deck.index, 1); h.clean();
});
