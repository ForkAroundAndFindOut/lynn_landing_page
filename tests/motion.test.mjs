import assert from 'node:assert/strict';
import test from 'node:test';
import { arrivalDirection, evaluatePose, evaluateStack, positionFromTravel, presetFor, releaseTarget, releaseVelocity, travelDistance } from '../motion.js';


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

test('centered scale compensation exposes 10px and 20px at every card height', () => {
  for (const cardHeight of [360, 503, 590]) {
    const poses = evaluateStack({ ...geometry, position: 3, cardHeight });
    for (const pose of poses) {
      const depth = 3 - pose.index;
      const exposed = -(pose.y + cardHeight * (1 - pose.scale) / 2);
      assert.ok(Math.abs(exposed - depth * 10) < 1e-9);
    }
    for (const progress of [0.001, 0.25, 0.75, 0.999]) {
      const poses = evaluateStack({ ...geometry, position: 2 + progress, cardHeight });
      for (const pose of poses.filter(pose => pose.index <= 2)) {
        const depth = Math.min(2 + progress - pose.index, 2);
        assert.ok(Math.abs(pose.y + cardHeight * (1 - pose.scale) / 2 + depth * 10) < 1e-9);
      }
    }
  }
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
  for (const [name, duration, minimum, maximum] of [['crisp', 600, 192, 288], ['balanced', 900, 240, 400], ['gentle', 1300, 336, 528]]) {
    assert.equal(presetFor(name).duration, duration);
    assert.equal(travelDistance(100, name), minimum);
    assert.equal(travelDistance(2000, name), maximum);
  }
});


