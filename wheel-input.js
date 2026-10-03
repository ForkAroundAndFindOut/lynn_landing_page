import { clamp } from './motion.js';

// Wheel deltas describe scroll intent, not a finger's travel. One CSS line is
// enough to commit a deliberate notch; larger streams follow the whole path.
export const WHEEL = Object.freeze({ line: 16, distance: 80, commit: 16, quiet: 180 });

export function normalizeWheel(event, height) {
  const factor = event.deltaMode === 1 ? WHEEL.line : event.deltaMode === 2 ? height : 1;
  const x = Number(event.deltaX || 0) * factor;
  const y = Number(event.deltaY || 0) * factor;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export function wheelTravel(origin, travel, delta, count) {
  // Discard excess momentum at either endpoint. Reversing therefore retraces
  // immediately instead of paying off an invisible accumulator of inertia.
  return clamp(travel + delta, -Math.min(1, origin) * WHEEL.distance, Math.min(1, count - 1 - origin) * WHEEL.distance);
}

export function wheelTarget(origin, travel, count) {
  return clamp(origin + (Math.abs(travel) >= WHEEL.commit ? Math.sign(travel) : 0), 0, count - 1);
}
