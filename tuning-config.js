// Canonical units are seconds, pixels, pixels per millisecond, and fractions.
const field = (key, label, group, value, min, max, step, unit) => Object.freeze({ key, label, group, default: value, min, max, step, unit });
export const TUNING_FIELDS = Object.freeze([
  field('duration', 'Transition duration', 'Timing and gate', .9, .2, 3, .05, 's'),
  field('gate', 'Request gate', 'Timing and gate', .3, 0, 2, .05, 's'),
  field('swipeDistance', 'Swipe distance', 'Gesture recognition', 48, 16, 160, 2, 'px'),
  field('deadZone', 'Direction dead zone', 'Gesture recognition', 6, 2, 12, 1, 'px'),
  field('verticalRatio', 'Vertical direction ratio', 'Gesture recognition', 1.2, 1, 3, .1, '×'),
  field('holdDelay', 'Hold delay', 'Gesture recognition', .35, .2, .8, .05, 's'),
  Object.freeze({ key: 'flickEnabled', label: 'Enable flick shortcut', group: 'Gesture recognition', default: true, type: 'boolean' }),
  field('flickDistance', 'Minimum flick distance', 'Gesture recognition', 16, 12, 48, 2, 'px'),
  field('flickVelocity', 'Flick velocity', 'Gesture recognition', .45, .1, 2, .05, 'px/ms'),
  field('velocityWindow', 'Velocity sample window', 'Gesture recognition', .08, .04, .16, .01, 's'),
  field('wheelThreshold', 'Wheel threshold', 'Wheel input', 16, 4, 160, 4, 'px'),
  field('wheelQuiet', 'Wheel quiet period', 'Wheel input', .4, .05, 1, .05, 's'),
  field('acceleration', 'Acceleration interval', 'Motion shape', .15, 0, .45, .01, 'fraction'),
  field('deceleration', 'Deceleration interval', 'Motion shape', .35, 0, .45, .01, 'fraction'),
  field('magneticStrength', 'Magnetic strength', 'Motion shape', .25, 0, 2, .05, '×'),
  field('magneticOnset', 'Magnetic onset', 'Motion shape', .65, .4, .9, .05, 'fraction'),
  field('bounceAmplitude', 'Bounce amplitude', 'Motion shape', 0, 0, 12, 1, 'px'),
  field('bounceCycles', 'Bounce cycles', 'Motion shape', 1, 1, 3, 1, 'cycles'),
  field('rotation', 'Rotation multiplier', 'Card geometry', 1, 0, 1.5, .05, '×'),
  field('curvature', 'Arc curvature', 'Card geometry', 1, .5, 1.5, .05, '×'),
  field('layerOffset', 'Layer offset', 'Card geometry', 10, 0, 24, 1, 'px'),
  field('layerScale', 'Layer scale step', 'Card geometry', .03, 0, .06, .005, 'fraction'),
  field('arrivalScale', 'Arrival scale', 'Card geometry', .965, .9, 1, .005, '×'),
  field('opacityRamp', 'Opacity ramp', 'Card appearance', .125, 0, .5, .025, 'fraction'),
  field('shadowStrength', 'Shadow strength', 'Card appearance', 1, .5, 1.5, .05, '×'),
]);
export const DEFAULT_TUNING = Object.freeze(Object.fromEntries(TUNING_FIELDS.map(item => [item.key, item.default])));
export function sanitizeTuning(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.freeze(Object.fromEntries(TUNING_FIELDS.map(item => {
    const raw = source[item.key];
    if (item.type === 'boolean') return [item.key, typeof raw === 'boolean' ? raw : item.default];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return [item.key, item.default];
    const bounded = Math.max(item.min, Math.min(item.max, raw));
    const aligned = item.min + Math.round((bounded - item.min) / item.step) * item.step;
    return [item.key, Number(Math.max(item.min, Math.min(item.max, aligned)).toFixed(6))];
  })));
}
const motionPresets = Object.freeze({
  crisp: { duration: .6, acceleration: .10, deceleration: .25, magneticStrength: .15 },
  balanced: { duration: .9, acceleration: .15, deceleration: .35, magneticStrength: .25 },
  gentle: { duration: 1.3, acceleration: .25, deceleration: .45, magneticStrength: .4 },
});
export function applyMotionPreset(value, name) {
  return sanitizeTuning({ ...sanitizeTuning(value), ...(motionPresets[name] ?? {}) });
}
