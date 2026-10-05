import assert from 'node:assert/strict';
import test from 'node:test';
import { velocityCurve, bounceOffset, evaluateStack } from '../motion.js';
import { DEFAULT_TUNING } from '../tuning-config.js';
import { harness } from './tuning-harness.mjs';

test('gate accepts exact boundary, drops early requests, and reads live changes', t => {
  const h = harness(t, {}, true);
  assert.equal(h.deck.navigate(1), true); assert.equal(h.deck.gateRemaining, 300);
  h.advance(299); assert.equal(h.deck.navigate(1), false); assert.equal(h.deck.lastRejection, 'gate');
  h.advance(1); assert.equal(h.deck.navigate(1), true); assert.equal(h.deck.index, 2);
  h.tuning.gate = 1; h.advance(400); assert.equal(h.deck.navigate(1), false);
  h.tuning.gate = 0.2; assert.equal(h.deck.navigate(1), true);
  h.advance(1000); assert.deepEqual(h.requests, [1, 2, 3]); assert.equal(h.deck.index, 3);
});
test('endpoint rejection does not advance gate, while directions remain relative to requested target', t => {
  const h = harness(t, { gate: 0.1, duration: 1 });
  assert.equal(h.deck.navigate(-1), false); assert.equal(h.deck.gateRemaining, 0);
  h.deck.navigate(1); h.tick(100); const first = h.deck.position;
  h.deck.navigate(1); assert.equal(h.deck.requestedIndex, 2); assert.equal(h.deck.position, first);
  h.tick(100); h.deck.navigate(-1); assert.equal(h.deck.requestedIndex, 1);
  h.drain(); assert.equal(h.deck.index, 1); assert.deepEqual(h.changes.map(c => c.index), [1]);
});
test('retarget starts from analytically sampled position and duration scales per remaining card', t => {
  const h = harness(t, { gate: 0, duration: 1, acceleration: 0, deceleration: 0, magneticStrength: 0 });
  h.deck.navigate(1); h.advance(400); // No RAF has rendered at this time.
  h.deck.navigate(1); assert.equal(h.deck.position, 0.4); assert.equal(h.deck.requestedIndex, 2);
  h.tick(1599); assert.equal(h.deck.state, 'settling'); h.tick(1); assert.equal(h.deck.index, 2);
  h.deck.navigate(-1); h.tick(250); assert.equal(h.deck.position, 1.75);
  h.deck.navigate(1); h.tick(249); assert.equal(h.deck.state, 'settling'); h.tick(1); assert.equal(h.deck.index, 2);
});
test('all visible cards preserve C0 transforms when retargeted under new geometry and bounce', t => {
  const h = harness(t, { gate: 0, bounceAmplitude: 20 });
  h.deck.navigate(1); h.tick(760);
  const before = h.cards.map(card => ({ transform: card.style.transform, opacity: card.style.opacity, visibility: card.style.visibility }));
  Object.assign(h.tuning, { layerOffset: 22, layerScale: 0.08, rotation: 2, curvature: 1.6, shadowStrength: 0.3 });
  h.deck.navigate(1);
  h.cards.forEach((card, i) => {
    if (before[i].visibility !== 'visible') return;
    const numbers = value => value.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);
    numbers(card.style.transform).forEach((value, n) => assert.ok(Math.abs(value - numbers(before[i].transform)[n]) < 1e-10));
    assert.ok(Math.abs(Number(card.style.opacity) - Number(before[i].opacity)) < 1e-10);
  });
  h.drain(); assert.equal(h.deck.index, 2);
});
test('running geometry and duration are snapshots; idle changes wait until a command', t => {
  const h = harness(t);
  const before = h.cards[0].style.transform; h.tuning.layerScale = 0.1; h.tuning.layerOffset = 25;
  h.deck.measure(); assert.equal(h.cards[0].style.transform, before);
  h.deck.navigate(1); h.tick(300); const expected = h.deck.position;
  Object.assign(h.tuning, { duration: 3, curvature: 0.3, rotation: 0.2 }); h.tick(300);
  assert.ok(h.deck.position > expected); h.tick(300); assert.equal(h.deck.state, 'idle'); assert.equal(h.deck.index, 1);
});
test('in-flight cards are inert after focus is moved, stable notification occurs only on final finish', t => {
  const h = harness(t, { gate: 0 }); document.activeElement = h.cards[0];
  h.deck.navigate(1); assert.equal(document.activeElement, h.stage);
  assert.ok(h.cards.every(c => c.inert && c.attrs['aria-hidden'] === 'true'));
  h.tick(300); h.deck.navigate(1); assert.equal(h.changes.length, 0); h.drain();
  assert.equal(h.cards[2].inert, false); assert.equal(h.changes.length, 1); assert.equal(h.changes[0].index, 2);
});
test('normalized velocity integral is monotonic, exact at endpoints, cached, and zero ramps are linear', () => {
  for (const acceleration of [0, 0.15, 0.45]) for (const deceleration of [0, 0.35, 0.45]) {
    const cfg = { acceleration, deceleration, magneticStrength: 3, magneticOnset: 0.65 }, curve = velocityCurve(cfg);
    assert.equal(velocityCurve(cfg), curve); assert.equal(curve(0), 0); assert.equal(curve(1), 1);
    let last = 0; for (let i = 0; i <= 1000; i++) { const value = curve(i / 1000); assert.ok(value >= last && value <= 1); last = value; }
  }
  const linear = velocityCurve({ acceleration: 0, deceleration: 0, magneticStrength: 0 }); assert.equal(linear(0.25), 0.25);
});
test('bounce has zero ends and never changes position, bounded stack or a next-card appearance', t => {
  assert.equal(bounceOffset(0.75, 10, 1), 0); assert.equal(bounceOffset(1, 10, 1), 0); assert.notEqual(bounceOffset(0.8, 10, 1), 0);
  const h = harness(t, { bounceAmplitude: 40, bounceCycles: 3 }); h.deck.navigate(1);
  for (let i = 0; i < 20; i++) { h.tick(45); assert.ok(h.deck.position >= 0 && h.deck.position <= 1); assert.equal(h.cards[2].style.visibility, 'hidden'); }
  assert.equal(h.deck.position, 1); assert.equal(h.cards[1].style.transform, 'translate3d(calc(-50% + 0px), calc(-50% + 0px), 0) rotate(0deg) scale(1)');
});
test('all geometry fields change their own pose quantities', () => {
  const args = { position: 1.5, count: 6, width: 358, height: 640, cardHeight: 570, tuning: DEFAULT_TUNING };
  const first = evaluateStack(args), changed = evaluateStack({ ...args, tuning: { ...DEFAULT_TUNING, rotation: 2, curvature: 2, arrivalScale: 0.8, layerOffset: 25, layerScale: 0.1, opacityRamp: 1, shadowStrength: 0.2 } });
  assert.notEqual(first[0].y, changed[0].y); assert.notEqual(first[0].scale, changed[0].scale);
  for (const field of ['x', 'y', 'angle', 'scale', 'opacity', 'shadow']) assert.notEqual(first.at(-1)[field], changed.at(-1)[field], field);
});
test('interruption uses global nearest current position and cleans capture, wheel, timers and request anchor', t => {
  const h = harness(t, { gate: 0, acceleration: 0, deceleration: 0, magneticStrength: 0 });
  h.deck.navigate(1); h.tick(100); h.deck.navigate(1); h.tick(100); h.deck.navigate(1); h.tick(2100);
  assert.ok(h.deck.position > 2); h.deck.settle(); assert.equal(h.deck.index, Math.round(h.deck.position)); assert.ok(h.deck.index >= 2); assert.equal(h.deck.requestedIndex, h.deck.index); h.clean();
  h.wheel(16); h.down(); h.deck.measure(); h.clean();
  h.deck.navigate(-1); document.hidden = true; h.dispatch('visibilitychange'); h.clean(); document.hidden = false;
  h.deck.setEnabled(false); assert.ok(h.cards.every(c => !c.inert && !('aria-hidden' in c.attrs)));
});
test('direct jumps bypass gate and retain 180ms fade; interruption removes their metadata', t => {
  const h = harness(t); h.deck.navigate(1); h.deck.jump(5, { contact: true });
  assert.equal(h.deck.requestedIndex, 5); h.tick(90); assert.equal(h.deck.position, 5); assert.ok(h.cards.every(c => c.inert)); h.tick(90);
  assert.equal(h.deck.index, 5); assert.equal(h.changes.at(-1).contact, true); h.deck.jump(0); h.tick(20); h.deck.settle(); h.clean();
});
test('adjacent commands preserve painted opacity when interrupting either half of a jump fade', t => {
  const h = harness(t, { gate: 0 });
  for (const elapsed of [30, 120]) {
    h.deck.jump(0); h.drain(); h.deck.jump(5); h.tick(elapsed);
    const before = h.cards.map(card => Number(card.style.opacity || 0));
    h.deck.navigate(-1);
    h.cards.forEach((card, i) => assert.ok(Math.abs(Number(card.style.opacity || 0) - before[i]) < 1e-10));
    h.deck.settle(); h.clean();
  }
});
test('zero-distance reversal in both jump directions smoothly recovers fade without moving position', t => {
  const h = harness(t, { gate: 0, bounceAmplitude: 20 });
  for (const [origin, destination, delta] of [[0, 1, -1], [1, 0, 1]]) {
    h.deck.jump(origin); h.drain(); h.changes.length = 0;
    h.deck.jump(destination); h.tick(30);
    const opacity = Number(h.cards[origin].style.opacity), transform = h.cards[origin].style.transform;
    assert.ok(opacity > 0 && opacity < 1); h.deck.navigate(delta);
    assert.equal(h.deck.position, origin); assert.equal(h.deck.requestedIndex, origin); assert.equal(h.deck.state, 'settling');
    assert.equal(Number(h.cards[origin].style.opacity), opacity); assert.equal(h.cards[origin].style.transform, transform); assert.equal(h.changes.length, 0);
    h.tick(50); assert.equal(h.deck.position, origin); assert.ok(Number(h.cards[origin].style.opacity) > opacity && Number(h.cards[origin].style.opacity) < 1);
    h.tick(50); assert.equal(h.deck.position, origin); assert.equal(Number(h.cards[origin].style.opacity), 1); assert.equal(h.cards[origin].style.transform, transform);
    assert.equal(h.deck.state, 'idle'); assert.equal(h.cards[origin].inert, false); assert.deepEqual(h.changes.map(change => change.index), [origin]); h.clean();
  }
});
