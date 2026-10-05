import { MOTION, clamp, easeOut, evaluateStack, presetFor, releaseVelocity, smoothstep, velocityCurve, bounceOffset } from './motion.js';
import { normalizeWheel } from './wheel-input.js';
import { DEFAULT_TUNING } from './tuning-config.js';

const ACTIVATION_START = 'a, button, [role="button"], [role="link"]';
const INTERACTIVE_START = 'input, textarea, select, option, label, summary, [contenteditable], [data-no-drag], [role="checkbox"], [role="combobox"], [role="listbox"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="radio"], [role="slider"], [role="spinbutton"], [role="switch"], [role="tab"], [role="textbox"], [role="treeitem"]';
const MOUSE_EXCLUDED_START = `${INTERACTIVE_START}, p, h1, h2, h3, h4, h5, h6, li, span, strong, em, small, blockquote, code, pre, dt, dd`;
const WHEEL_EXCLUDED = 'input, textarea, select, option, [contenteditable], [data-no-drag], [data-no-wheel], [role="combobox"], [role="listbox"], [role="slider"], [role="spinbutton"], [role="textbox"], [role="tree"]';
const OWNED_STYLES = ['transform', 'opacity', 'visibility', 'z-index', 'will-change', '--card-shadow-strength'];
const POSE_PROPERTIES = ['x', 'y', 'angle', 'scale', 'opacity', 'shadow'];

export function createDeck({ stage, cards, onChange = () => {}, onRequest = () => {}, isBlocked = () => false, getPreset = () => 'balanced', getTuning, isReduced = () => false }) {
  let enabled = false, index = 0, requestedIndex = 0, announcedIndex = 0, position = 0;
  let state = 'idle', gesture = null, animation = null, frame = 0, holdTimer = 0;
  let width = 320, height = 540, cardHeight = 0, fade = 1;
  let wheel = null, wheelTimer = 0, multiTouch = false;
  let lastAcceptedAt = -Infinity, lastRejection = null;
  let suppressedClick = null;
  const touchContacts = new Set(), ids = cards.map(card => card.id);
  const readTuning = () => {
    const preset = presetFor(getPreset());
    return { ...DEFAULT_TUNING, ...(!getTuning ? { duration: preset.duration / 1000, rotation: preset.rotation, curvature: preset.curvature } : {}), ...(getTuning?.() || {}) };
  };
  let poseTuning = readTuning();
  const clock = () => performance.now();
  const gateRemaining = () => Math.max(0, readTuning().gate * 1000 - (clock() - lastAcceptedAt));
  function rejection(reason) { lastRejection = reason; stage.dataset.deckRejection = reason || ''; }

  function syncSemantics() {
    const focused = document.activeElement;
    if (cards.some((card, cardIndex) => (state !== 'idle' || cardIndex !== index) && card.contains(focused))) stage.focus({ preventScroll: true });
    cards.forEach((card, cardIndex) => {
      const active = state === 'idle' && cardIndex === index;
      card.inert = !active;
      if (active) card.removeAttribute('aria-hidden'); else card.setAttribute('aria-hidden', 'true');
      card.toggleAttribute('data-active', active);
    });
  }
  function basePoses() {
    return new Map(evaluateStack({ position, count: cards.length, width, height, cardHeight, ids, tuning: poseTuning }).map(pose => [pose.index, pose]));
  }
  function currentPoses(now = clock()) {
    const poses = basePoses();
    if (!animation || animation.jump) return poses;
    const s = clamp((now - animation.started) / animation.duration, 0, 1);
    const offset = animation.recovery ? 0 : bounceOffset(s, poseTuning.bounceAmplitude, poseTuning.bounceCycles), targetPose = poses.get(animation.target);
    if (targetPose && offset) {
      // Forward travel approaches on the stored arrival path; reverse travel
      // approaches through the resting layer's scale/offset path.
      const args = { count: cards.length, width, height, cardHeight, ids, tuning: poseTuning };
      const end = evaluateStack({ ...args, position: animation.target }).find(pose => pose.index === animation.target);
      const before = evaluateStack({ ...args, position: animation.target - Math.sign(animation.target - animation.from) * 0.001 }).find(pose => pose.index === animation.target);
      const dx = end.x - before.x, dy = end.y - before.y, length = Math.hypot(dx, dy) || 1;
      targetPose.x += offset * dx / length; targetPose.y += offset * dy / length;
    }
    const blend = 1 - smoothstep((now - animation.started) / animation.residualDuration);
    if (blend > 0 && animation.residual) for (const [cardIndex, correction] of animation.residual) {
      const pose = poses.get(cardIndex) || { ...correction.base, opacity: 0 };
      for (const property of POSE_PROPERTIES) pose[property] += correction[property] * blend;
      poses.set(cardIndex, pose);
    }
    return poses;
  }
  function render(now = clock()) {
    if (!enabled) return;
    const poses = currentPoses(now);
    cards.forEach((card, cardIndex) => {
      const pose = poses.get(cardIndex);
      if (!pose || pose.opacity <= 0) { card.style.visibility = 'hidden'; card.style.opacity = '0'; card.style.removeProperty('will-change'); return; }
      card.style.visibility = 'visible';
      card.style.transform = `translate3d(calc(-50% + ${pose.x}px), calc(-50% + ${pose.y}px), 0) rotate(${pose.angle}deg) scale(${pose.scale})`;
      card.style.opacity = String(clamp(pose.opacity * fade, 0, 1)); card.style.zIndex = String(pose.zIndex);
      card.style.setProperty('--card-shadow-strength', pose.shadow);
      if (state !== 'idle') card.style.willChange = 'transform, opacity'; else card.style.removeProperty('will-change');
    });
    stage.dataset.deckState = state; stage.dataset.deckPosition = position.toFixed(3);
  }
  function cancelFrame() { if (frame) cancelAnimationFrame(frame); frame = 0; }
  function releaseCapture() {
    const pointerId = gesture?.pointerId; gesture = null;
    if (holdTimer) clearTimeout(holdTimer); holdTimer = 0;
    stage.classList?.remove('is-deck-dragging');
    if (pointerId !== undefined && stage.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId);
  }
  function resetWheel() { if (wheelTimer) clearTimeout(wheelTimer); wheelTimer = 0; wheel = null; }
  function finish(target, options = {}, notify = true) {
    cancelFrame(); animation = null; state = 'idle';
    position = index = requestedIndex = clamp(target, 0, cards.length - 1); fade = 1;
    if (enabled) { syncSemantics(); render(); }
    if (notify) { announcedIndex = index; onChange(index, { focus: Boolean(options.focus), contact: Boolean(options.contact) }); }
  }
  function sampleAnimation(now) {
    if (!animation) return;
    const s = clamp((now - animation.started) / animation.duration, 0, 1);
    if (animation.jump) {
      if (s >= 0.5) index = position = animation.target;
      fade = s < 0.5 ? 1 - easeOut(s * 2) : easeOut((s - 0.5) * 2);
    } else position = animation.from + (animation.target - animation.from) * animation.curve(s);
  }
  function startTimeline(target, options, configuration, now, previousPoses) {
    cancelFrame(); poseTuning = { ...configuration }; fade = 1;
    const travelDuration = configuration.duration * 1000 * Math.abs(target - position);
    if (isReduced()) { finish(target, options); return; }
    const bases = basePoses(), residual = new Map();
    if (previousPoses) for (const cardIndex of new Set([...bases.keys(), ...previousPoses.keys()])) {
      const old = previousPoses.get(cardIndex), base = bases.get(cardIndex), reference = base || { ...old, opacity: 0 };
      const correction = { base: reference };
      for (const property of POSE_PROPERTIES) correction[property] = (old?.[property] ?? (property === 'opacity' ? 0 : reference[property])) - reference[property];
      residual.set(cardIndex, correction);
    }
    // A reversal before a jump's midpoint can already be at its destination,
    // while the painted card is partially faded. Recover only the residual
    // pose; ordinary travel keeps its exact per-card duration.
    const recovery = travelDuration <= 0.00001 && [...residual.values()].some(correction => POSE_PROPERTIES.some(property => Math.abs(correction[property]) > 1e-10));
    if (travelDuration <= 0.00001 && !recovery) { finish(target, options); return; }
    const duration = recovery ? 100 : travelDuration;
    state = 'settling';
    const motion = { target, options, from: position, started: now, duration, recovery, curve: velocityCurve(configuration), residual, residualDuration: recovery ? duration : Math.min(100, duration / 4) };
    animation = motion; syncSemantics(); render(now);
    function tick(timestamp) {
      frame = 0;
      if (animation !== motion) return;
      if (isBlocked() || document.hidden) { settle(); return; }
      sampleAnimation(timestamp); render(timestamp);
      if (timestamp - motion.started < duration) frame = requestAnimationFrame(tick); else finish(target, options);
    }
    frame = requestAnimationFrame(tick);
  }
  function settle() {
    sampleAnimation(clock());
    const target = clamp(Math.round(position), 0, cards.length - 1);
    resetWheel(); releaseCapture(); touchContacts.clear(); multiTouch = false;
    lastAcceptedAt = -Infinity; rejection(null); finish(target, {}, target !== announcedIndex); return index;
  }
  function measure() {
    if (animation || gesture || wheel) settle();
    height = stage.clientHeight || stage.getBoundingClientRect().height || height;
    width = cards[index]?.offsetWidth || width; cardHeight = cards[index]?.offsetHeight || 0; render();
  }
  function setEnabled(value) {
    const next = Boolean(value);
    if (next === enabled) { if (next) measure(); return; }
    settle(); enabled = next;
    if (enabled) { stage.addEventListener('wheel', onWheel, { passive: false }); measure(); syncSemantics(); render(); }
    else {
      stage.removeEventListener?.('wheel', onWheel);
      cards.forEach(card => { for (const property of OWNED_STYLES) card.style.removeProperty(property); card.inert = false; card.removeAttribute('aria-hidden'); card.removeAttribute('data-active'); });
      delete stage.dataset.deckState; delete stage.dataset.deckPosition; delete stage.dataset.deckRejection;
    }
  }
  function navigate(delta, { focus = true, source = 'control' } = {}) {
    if (!enabled || isBlocked() || document.hidden || !delta) { rejection('blocked'); return false; }
    const configuration = readTuning(), now = clock(), target = clamp(requestedIndex + Math.sign(delta), 0, cards.length - 1);
    if (target === requestedIndex) { rejection('endpoint'); return false; }
    if (now - lastAcceptedAt < configuration.gate * 1000) { rejection('gate'); return false; }
    sampleAnimation(now); const previousPoses = currentPoses(now);
    // A direct jump may be interrupted during either half of its fade. Preserve
    // the painted opacity, including that fade, before the new timeline resets it.
    if (fade !== 1) for (const pose of previousPoses.values()) pose.opacity *= fade;
    if (source !== 'gesture') releaseCapture();
    requestedIndex = target; lastAcceptedAt = now; rejection(null); onRequest(target);
    startTimeline(target, { focus }, configuration, now, previousPoses); return true;
  }
  function jump(destination, { focus = true, contact = false } = {}) {
    if (isBlocked()) return false;
    const target = clamp(Math.round(destination), 0, cards.length - 1);
    settle(); poseTuning = readTuning(); requestedIndex = target; onRequest(target);
    const options = { focus, contact };
    if (!enabled || isReduced() || target === index) { finish(target, options); return true; }
    state = 'settling'; syncSemantics();
    const motion = { jump: true, target, options, started: clock(), duration: MOTION.jumpDuration };
    animation = motion; render();
    function tick(timestamp) {
      frame = 0;
      if (animation !== motion) return;
      if (isBlocked() || document.hidden) { settle(); return; }
      sampleAnimation(timestamp); render(timestamp);
      if (timestamp - motion.started < motion.duration) frame = requestAnimationFrame(tick); else finish(target, options);
    }
    frame = requestAnimationFrame(tick); return true;
  }
  function hasSelection() { const selection = window.getSelection(); return selection && !selection.isCollapsed; }
  function nestedScroller(target) {
    for (let node = target; node && node !== stage; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight && /^(auto|scroll|overlay)$/.test(window.getComputedStyle(node).overflowY)) return true;
    }
    return false;
  }
  function wheelQuiet() {
    if (wheelTimer) clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelTimer = 0; wheel = null; }, readTuning().wheelQuiet * 1000);
  }
  function onWheel(event) {
    if (!enabled || isBlocked() || document.hidden) { if (wheel || animation) settle(); return; }
    const configuration = readTuning(), delta = normalizeWheel(event, height);
    if (!delta || !delta.y || Math.abs(delta.y) < Math.abs(delta.x) * configuration.verticalRatio || event.ctrlKey || event.metaKey || event.shiftKey || hasSelection() || event.target.closest(WHEEL_EXCLUDED) || nestedScroller(event.target)) {
      if (wheel?.consumed) wheelQuiet(); else resetWheel(); return;
    }
    if (gesture || multiTouch) return;
    const targetCard = event.target.closest('.card');
    if (state === 'idle' && targetCard && targetCard !== cards[index]) return;
    event.preventDefault(); wheel ||= { intent: 0, consumed: false }; wheelQuiet();
    if (wheel.consumed) return;
    wheel.intent += delta.y;
    if (Math.abs(wheel.intent) < configuration.wheelThreshold) return;
    wheel.consumed = true; navigate(Math.sign(wheel.intent), { focus: false, source: 'wheel' });
  }
  function trackTouchDown(event) {
    // A new primary press begins a new activation, rather than inheriting a
    // previous drag's click suppression. Keyboard/programmatic clicks bypass it.
    if (event.isPrimary) suppressedClick = null;
    if (event.pointerType !== 'touch') return;
    touchContacts.add(event.pointerId);
    if (touchContacts.size > 1) { multiTouch = true; releaseCapture(); }
  }
  function trackTouchEnd(event) {
    if (event.pointerType === 'touch') { touchContacts.delete(event.pointerId); if (!touchContacts.size) multiTouch = false; }
    if (gesture?.pointerId === event.pointerId && !stage.contains?.(event.target) && event.target !== stage) releaseCapture();
  }
  document.addEventListener('pointerdown', trackTouchDown, true);
  document.addEventListener('pointerup', trackTouchEnd, true);
  document.addEventListener('pointercancel', event => { trackTouchEnd(event); cancelGesture(event); }, true);
  stage.addEventListener('pointerdown', event => {
    trackTouchDown(event);
    if (!enabled || isBlocked() || document.hidden || multiTouch || gesture || !event.isPrimary || event.button !== 0) return;
    const activation = event.target.closest(ACTIVATION_START);
    const excluded = event.pointerType === 'mouse' && !activation ? MOUSE_EXCLUDED_START : INTERACTIVE_START;
    if (event.target.closest(excluded) || hasSelection() || nestedScroller(event.target)) return;
    const targetCard = event.target.closest('.card');
    if (state === 'idle' && targetCard && targetCard !== cards[index]) return;
    if (event.pointerType === 'mouse' && !activation) event.preventDefault();
    const configuration = readTuning();
    gesture = { pointerId: event.pointerId, pointerType: event.pointerType, activation, startTarget: event.target, acquired: false, consumed: false, deadline: event.timeStamp + configuration.holdDelay * 1000, startX: event.clientX, startY: event.clientY, samples: [{ time: event.timeStamp, position: 0 }] };
    if (event.pointerType === 'touch') {
      const candidate = gesture;
      holdTimer = setTimeout(() => { holdTimer = 0; if (gesture === candidate && !gesture.acquired) releaseCapture(); }, configuration.holdDelay * 1000);
    }
  });
  function recognize(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (isBlocked() || document.hidden) { settle(); return; }
    if (hasSelection() || (!gesture.acquired && gesture.pointerType === 'touch' && event.timeStamp >= gesture.deadline)) { releaseCapture(); return; }
    const configuration = readTuning(), horizontal = event.clientX - gesture.startX, travel = gesture.startY - event.clientY;
    gesture.samples.push({ time: event.timeStamp, position: travel });
    while (gesture.samples.length > 2 && gesture.samples[1].time < event.timeStamp - configuration.velocityWindow * 1000) gesture.samples.shift();
    if (!gesture.acquired) {
      if (Math.hypot(horizontal, travel) < configuration.deadZone) return;
      if (Math.abs(travel) < Math.abs(horizontal) * configuration.verticalRatio) { releaseCapture(); return; }
      gesture.acquired = true;
      if (holdTimer) clearTimeout(holdTimer); holdTimer = 0;
      stage.classList?.add('is-deck-dragging'); stage.setPointerCapture(event.pointerId);
      suppressedClick = { pointerId: event.pointerId, origin: gesture.startTarget, startX: gesture.startX, startY: gesture.startY, x: event.clientX, y: event.clientY, time: clock() };
    }
    if (suppressedClick?.pointerId === event.pointerId) Object.assign(suppressedClick, { x: event.clientX, y: event.clientY, time: clock() });
    event.preventDefault();
    if (gesture.consumed) return;
    const velocity = releaseVelocity(gesture.samples, configuration.velocityWindow * 1000);
    // Actionable starts use the full distance: a quick small tap drift must not
    // become a flick that navigates away or opens the contact form.
    const flick = !gesture.activation && configuration.flickEnabled && Math.abs(travel) >= configuration.flickDistance && Math.abs(velocity) >= configuration.flickVelocity && Math.sign(velocity) === Math.sign(travel);
    if (Math.abs(travel) < configuration.swipeDistance && !flick) return;
    gesture.consumed = true; navigate(Math.sign(travel), { focus: false, source: 'gesture' });
  }
  stage.addEventListener('pointermove', event => { if (event.pointerType === 'mouse' && event.buttons === 0) { cancelGesture(event); return; } recognize(event); }, { passive: false });
  stage.addEventListener('pointerup', event => { recognize(event); trackTouchEnd(event); if (gesture?.pointerId === event.pointerId) releaseCapture(); });
  stage.addEventListener('dragstart', event => { if (gesture) event.preventDefault(); });
  stage.addEventListener('click', event => {
    const pending = suppressedClick;
    if (!pending || event.detail === 0) return;
    if (clock() - pending.time > 750) { suppressedClick = null; return; }
    const matchesPointer = typeof event.pointerId === 'number' && event.pointerId >= 0 ? event.pointerId === pending.pointerId
      : (Math.abs(event.clientX - pending.x) <= 6 && Math.abs(event.clientY - pending.y) <= 6
          || Math.abs(event.clientX - pending.startX) <= 6 && Math.abs(event.clientY - pending.startY) <= 6)
        && (event.target === stage || pending.origin === event.target || pending.origin.contains?.(event.target) || event.target.contains?.(pending.origin));
    if (!matchesPointer) return;
    suppressedClick = null;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  function cancelGesture(event) { if (gesture && (!event || event.pointerId === gesture.pointerId)) releaseCapture(); }
  stage.addEventListener('pointercancel', event => { trackTouchEnd(event); cancelGesture(event); });
  stage.addEventListener('lostpointercapture', event => { if (event.target === stage && !stage.hasPointerCapture(event.pointerId)) cancelGesture(event); });
  stage.addEventListener('pointerleave', event => { if (!gesture?.acquired) cancelGesture(event); });
  stage.addEventListener('contextmenu', () => { resetWheel(); cancelGesture(); });
  stage.addEventListener('selectstart', event => {
    if (gesture && (gesture.acquired || (gesture.pointerType === 'touch' && event.timeStamp < gesture.deadline))) event.preventDefault();
    else { resetWheel(); cancelGesture(); }
  });
  document.addEventListener('selectionchange', () => { if (hasSelection()) { resetWheel(); cancelGesture(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) settle(); });
  window.addEventListener?.('blur', settle);
  return { setEnabled, measure, navigate, jump, settle, refreshGate: gateRemaining, get gateRemaining() { return gateRemaining(); },
    get index() { return index; }, get requestedIndex() { return requestedIndex; }, get position() { return position; }, get state() { return state; }, get lastRejection() { return lastRejection; } };
}
