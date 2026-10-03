import { clamp } from './motion.js';

// Wheel deltas express navigation intent. They never control motion progress or
// animation duration. A quiet interval separates commands from inertial tails.
export const WHEEL = Object.freeze({ line: 16, commit: 16, quiet: 400 });

export function normalizeWheel(event, height) {
  const factor = event.deltaMode === 1 ? WHEEL.line : event.deltaMode === 2 ? height : 1;
  const x = Number(event.deltaX || 0) * factor;
  const y = Number(event.deltaY || 0) * factor;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export function wheelTarget(origin, intent, count) {
  return clamp(origin + (Math.abs(intent) >= WHEEL.commit ? Math.sign(intent) : 0), 0, count - 1);
}
