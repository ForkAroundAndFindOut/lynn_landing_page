// Motion is evaluated from a single continuous deck position. No DOM reads,
// frame-dependent randomness, or animation state belongs in this module.
export const PRESETS = Object.freeze({
  crisp: Object.freeze({ duration: 600, travelRatio: 0.32, minTravel: 192, maxTravel: 288, rotation: 0.82, curvature: 0.9 }),
  balanced: Object.freeze({ duration: 900, travelRatio: 0.45, minTravel: 240, maxTravel: 400, rotation: 1, curvature: 1 }),
  gentle: Object.freeze({ duration: 1300, travelRatio: 0.6, minTravel: 336, maxTravel: 528, rotation: 1.08, curvature: 1.06 }),
});

export const MOTION = Object.freeze({
  deadZone: 6,
  verticalRatio: 1.2,
  velocityWindow: 80,
  projectionTime: 120,
  layerOffset: 10,
  layerScale: 0.03,
  jumpDuration: 180,
});

export const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
export const easeOut = (progress) => 1 - (1 - clamp(progress, 0, 1)) ** 3;
export const presetFor = (name) => PRESETS[String(name).toLowerCase()] || PRESETS.balanced;
export const travelDistance = (height, name = 'balanced') => {
  const preset = presetFor(name);
  return clamp(height * preset.travelRatio, preset.minTravel, preset.maxTravel);
};

export function arrivalDirection(index) {
  return ['left', 'right', 'bottom'][((index - 1) % 3 + 3) % 3];
}

function variation(id) {
  let hash = 2166136261;
  for (const character of String(id)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return ((hash >>> 0) % 2001) / 1000 - 1;
}

function bezier(a, b, c, d, progress) {
  const remaining = 1 - progress;
  return remaining ** 3 * a + 3 * remaining ** 2 * progress * b + 3 * remaining * progress ** 2 * c + progress ** 3 * d;
}

/** A card's stored arrival path, relative to its settled center. */
export function evaluatePose({ index, id = index, progress, width, height, preset = 'balanced', tuning: configuration }) {
  const p = clamp(progress, 0, 1);
  const tuning = configuration || presetFor(preset);
  const seed = variation(id);
  const direction = arrivalDirection(index);
  const side = direction === 'right' ? 1 : -1;
  const curvature = tuning.curvature;
  const x = direction === 'bottom'
    ? bezier((0.07 + seed * 0.015) * width, -0.06 * width * curvature, 0.02 * width, 0, p)
    : bezier(side * (width + 80), side * (0.55 + seed * 0.02) * width, -side * 0.1 * width * curvature, 0, p);
  const y = direction === 'bottom'
    ? bezier(height + 80, 0.55 * height, -0.03 * height * curvature, 0, p)
    : bezier(-0.08 * height, (0.14 + seed * 0.015) * height * curvature, -0.08 * height, 0, p);
  const startAngle = (direction === 'bottom' ? 8 : side * 16) + seed * 1.6;
  return {
    x,
    y,
    angle: p === 1 ? 0 : startAngle * tuning.rotation * (1 - p) ** 1.35,
    scale: (tuning.arrivalScale ?? 0.965) + (1 - (tuning.arrivalScale ?? 0.965)) * p,
    opacity: clamp(p / Math.max(0.000001, tuning.opacityRamp ?? 0.125), 0, 1),
    shadow: (0.45 + 0.55 * p) * (tuning.shadowStrength ?? 1),
  };
}

/**
 * A continuous u gives identical poses whether approached forwards or backwards.
 * At most three resting layers and one adjacent arrival are returned.
 */
export function evaluateStack({ position, count, width, height, cardHeight = 0, ids = [], preset = 'balanced', tuning }) {
  if (count < 1) return [];
  const u = clamp(position, 0, count - 1);
  const base = Math.floor(u);
  const progress = u - base;
  const layers = [];
  for (let index = Math.max(0, base - 2); index <= base; index += 1) {
    const depth = u - index;
    // Fade the oldest exposed edge away as the fourth painted card arrives.
    const edgeOpacity = depth > 2 ? 3 - depth : 1;
    const visibleDepth = Math.min(depth, 2);
    const scale = 1 - (tuning?.layerScale ?? MOTION.layerScale) * visibleDepth;
    layers.push({
      index,
      x: 0,
      // Centered scaling otherwise pulls the top edge back toward the active
      // card. Compensate using card height, independently of path/stage height.
      y: depth === 0 ? 0 : -(tuning?.layerOffset ?? MOTION.layerOffset) * visibleDepth - cardHeight * (1 - scale) / 2,
      angle: 0,
      scale,
      opacity: (1 - Math.min(depth, 2) * 0.06) * edgeOpacity,
      shadow: (1 - Math.min(depth, 2) * 0.2) * (tuning?.shadowStrength ?? 1),
      zIndex: index + 1,
    });
  }
  if (progress > 0 && base + 1 < count) {
    const index = base + 1;
    layers.push({ index, ...evaluatePose({ index, id: ids[index] ?? index, progress, width, height, preset, tuning }), zIndex: index + 1 });
  }
  return layers;
}

export const smoothstep = (value) => { const x = clamp(value, 0, 1); return x * x * (3 - 2 * x); };

// A deterministic normalized integral, rather than a frame-by-frame simulation.
// Fixed quadrature bounds work and gives exact endpoints for every duration.
const curveCache = new Map();
const CURVE_STEPS = 2048;
export function velocityCurve(configuration = {}) {
  const a = clamp(configuration.acceleration ?? 0.15, 0, 0.45);
  const d = clamp(configuration.deceleration ?? 0.35, 0, 0.45);
  const strength = Math.max(0, configuration.magneticStrength ?? 0.25);
  const onset = clamp(configuration.magneticOnset ?? 0.65, 0, 1);
  const key = [a, d, strength, onset].join(':');
  if (curveCache.has(key)) return curveCache.get(key);
  const weight = (s) => {
    const base = a && s < a ? smoothstep(s / a) : d && s > 1 - d ? smoothstep((1 - s) / d) : 1;
    const z = onset < 1 ? clamp((s - onset) / (1 - onset), 0, 1) : 0;
    return base * (1 + strength * 16 * z * z * (1 - z) * (1 - z));
  };
  const cumulative = new Float64Array(CURVE_STEPS + 1);
  let previous = weight(0);
  for (let i = 1; i <= CURVE_STEPS; i += 1) {
    const next = weight(i / CURVE_STEPS);
    cumulative[i] = cumulative[i - 1] + (previous + next) / (2 * CURVE_STEPS);
    previous = next;
  }
  const total = cumulative[CURVE_STEPS];
  const curve = (progress) => {
    const s = clamp(progress, 0, 1);
    if (s === 0 || s === 1) return s;
    const fractional = s * CURVE_STEPS, i = Math.floor(fractional);
    return (cumulative[i] + (cumulative[i + 1] - cumulative[i]) * (fractional - i)) / total;
  };
  // Limit cache growth when controls are swept continuously.
  if (curveCache.size >= 128) curveCache.delete(curveCache.keys().next().value);
  curveCache.set(key, curve);
  return curve;
}

/** Bounce is an additive pose correction, never a change to deck position. */
export function bounceOffset(progress, amplitude = 0, cycles = 1) {
  if (progress <= 0.75 || progress >= 1 || !amplitude) return 0;
  const z = (progress - 0.75) * 4;
  return amplitude * Math.sin(2 * Math.PI * cycles * z) * Math.sin(Math.PI * z) ** 2;
}

/** Position in cards; gesture travel is positive upwards and bounded to one neighbor. */
export function positionFromTravel(origin, travel, distance, count) {
  return origin + clamp(travel / distance, Math.max(-1, -origin), Math.min(1, count - 1 - origin));
}

/**
 * Samples contain {time, position}, with position in upward-positive pixels.
 * Use only the final monotonic segment within the recent window. An earlier
 * fast movement therefore cannot overpower a deliberate reversal at release.
 */
export function releaseVelocity(samples, window = MOTION.velocityWindow) {
  if (samples.length < 2) return 0;
  const end = samples.at(-1);
  const cutoff = end.time - window;
  let finalDirection = 0;
  let start = end;
  for (let index = samples.length - 2; index >= 0; index -= 1) {
    const sample = samples[index];
    const next = samples[index + 1];
    if (next.time <= cutoff) break;
    const direction = Math.sign(next.position - sample.position);
    if (direction && finalDirection && direction !== finalDirection) break;
    if (direction) finalDirection = direction;
    if (sample.time < cutoff) {
      const fraction = (cutoff - sample.time) / (next.time - sample.time);
      start = { time: cutoff, position: sample.position + fraction * (next.position - sample.position) };
      break;
    }
    start = sample;
  }
  const elapsed = end.time - start.time;
  return elapsed > 0 ? (end.position - start.position) / elapsed : 0;
}

/** The exact midpoint stays at the origin; velocity is expressed in pixels/ms. */
export function releaseTarget({ position, origin, velocity = 0, distance, count, passedDeadZone = true }) {
  const minimum = Math.max(0, origin - 1);
  const maximum = Math.min(count - 1, origin + 1);
  const projected = clamp(position + (passedDeadZone ? velocity * MOTION.projectionTime / distance : 0), minimum, maximum);
  const lower = Math.floor(projected);
  const upper = Math.ceil(projected);
  if (Math.abs(projected - lower - 0.5) < 1e-9) return Math.abs(lower - origin) <= Math.abs(upper - origin) ? lower : upper;
  return Math.round(projected);
}
