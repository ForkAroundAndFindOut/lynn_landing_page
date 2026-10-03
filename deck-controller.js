import { MOTION, clamp, easeOut, evaluateStack, positionFromTravel, presetFor, releaseTarget, releaseVelocity, travelDistance } from './motion.js';

const INTERACTIVE_START = 'a, button, input, textarea, select, option, label, summary, [contenteditable], [data-no-drag], [role="button"], [role="link"], [role="checkbox"], [role="combobox"], [role="listbox"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="radio"], [role="slider"], [role="spinbutton"], [role="switch"], [role="tab"], [role="textbox"], [role="treeitem"]';
const MOUSE_EXCLUDED_START = `${INTERACTIVE_START}, p, h1, h2, h3, h4, h5, h6, li, span, strong, em, small, blockquote, code, pre, dt, dd`;
const TOUCH_HOLD_DELAY = 350;
const OWNED_STYLES = ['transform', 'opacity', 'visibility', 'z-index', 'will-change', '--card-shadow-strength'];

export function createDeck({ stage, cards, onChange = () => {}, isBlocked = () => false, getPreset = () => 'balanced', isReduced = () => false }) {
  let enabled = false;
  let index = 0;
  let announcedIndex = 0;
  let position = 0;
  let state = 'idle';
  let gesture = null;
  let animation = null;
  let pending = null;
  let frame = 0;
  let width = 320;
  let height = 540;
  let cardHeight = 0;
  let fade = 1;
  let holdTimer = 0;
  let multiTouch = false;
  const touchContacts = new Set();
  const ids = cards.map((card) => card.id);

  function syncSemantics() {
    // Never make the currently focused element inert before moving its focus.
    const focused = document.activeElement;
    if (cards.some((card, cardIndex) => cardIndex !== index && card.contains(focused))) stage.focus({ preventScroll: true });
    cards.forEach((card, cardIndex) => {
      const active = cardIndex === index;
      card.inert = !active;
      if (active) card.removeAttribute('aria-hidden');
      else card.setAttribute('aria-hidden', 'true');
      card.toggleAttribute('data-active', active);
    });
  }

  function render() {
    if (!enabled) return;
    const poses = new Map(evaluateStack({ position, count: cards.length, width, height, cardHeight, ids, preset: getPreset() }).map((pose) => [pose.index, pose]));
    cards.forEach((card, cardIndex) => {
      const pose = poses.get(cardIndex);
      if (!pose || pose.opacity <= 0) {
        card.style.visibility = 'hidden';
        card.style.opacity = '0';
        card.style.removeProperty('will-change');
        return;
      }
      card.style.visibility = 'visible';
      card.style.transform = `translate3d(calc(-50% + ${pose.x}px), calc(-50% + ${pose.y}px), 0) rotate(${pose.angle}deg) scale(${pose.scale})`;
      card.style.opacity = String(pose.opacity * fade);
      card.style.zIndex = String(pose.zIndex);
      card.style.setProperty('--card-shadow-strength', pose.shadow);
      if (state !== 'idle') card.style.willChange = 'transform, opacity';
      else card.style.removeProperty('will-change');
    });
    stage.dataset.deckState = state;
    stage.dataset.deckPosition = position.toFixed(3);
  }

  function cancelFrame() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function queueRender() {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; render(); });
  }

  function releaseCapture() {
    const pointerId = gesture?.pointerId;
    gesture = null;
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = 0;
    stage.classList?.remove('is-deck-dragging');
    if (pointerId !== undefined && stage.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId);
  }

  function finish(target, options = {}, notify = true) {
    cancelFrame();
    animation = null;
    state = 'idle';
    position = index = clamp(target, 0, cards.length - 1);
    fade = 1;
    if (enabled) { syncSemantics(); render(); }
    if (notify) {
      announcedIndex = index;
      onChange(index, { focus: Boolean(options.focus), contact: Boolean(options.contact) });
    }
  }

  function processPending() {
    const request = pending;
    pending = null;
    if (request && enabled && !isBlocked()) navigate(request.delta, request.options);
  }

  function animateTo(target, options) {
    cancelFrame();
    if (isReduced() || Math.abs(position - target) < 0.00001) {
      finish(target, options);
      processPending();
      return;
    }
    state = 'settling';
    const startPosition = position;
    const duration = presetFor(getPreset()).duration;
    const motion = { target, options, started: null };
    animation = motion;
    function tick(now) {
      frame = 0;
      if (animation !== motion) return;
      if (isBlocked()) { settle(); return; }
      if (motion.started === null) motion.started = now;
      const progress = clamp((now - motion.started) / duration, 0, 1);
      position = startPosition + (target - startPosition) * easeOut(progress);
      render();
      if (progress < 1) frame = requestAnimationFrame(tick);
      else { finish(target, options); processPending(); }
    }
    render();
    frame = requestAnimationFrame(tick);
  }

  function settle() {
    const target = releaseTarget({ position, origin: index, distance: 1, count: cards.length, passedDeadZone: false });
    pending = null;
    releaseCapture();
    finish(target, {}, target !== announcedIndex);
    return index;
  }

  function measure() {
    if (state !== 'idle' || gesture) settle();
    height = stage.clientHeight || stage.getBoundingClientRect().height || height;
    width = cards[index]?.offsetWidth || width;
    cardHeight = cards[index]?.offsetHeight || 0;
    render();
  }

  function setEnabled(value) {
    const next = Boolean(value);
    if (next === enabled) { if (next) measure(); return; }
    settle();
    enabled = next;
    if (enabled) {
      measure();
      syncSemantics();
      render();
    } else {
      cards.forEach((card) => {
        for (const property of OWNED_STYLES) card.style.removeProperty(property);
        card.inert = false;
        card.removeAttribute('aria-hidden');
        card.removeAttribute('data-active');
      });
      delete stage.dataset.deckState;
      delete stage.dataset.deckPosition;
    }
  }

  function navigate(delta, { focus = true } = {}) {
    if (!enabled || isBlocked() || !delta) return;
    const direction = Math.sign(delta);
    if (state === 'settling') { pending = { delta: direction, options: { focus } }; return; }
    if (state === 'dragging') return;
    releaseCapture();
    const target = clamp(index + direction, 0, cards.length - 1);
    if (target !== index) animateTo(target, { focus });
  }

  function jump(destination, { focus = true, contact = false } = {}) {
    if (isBlocked()) return;
    const target = clamp(Math.round(destination), 0, cards.length - 1);
    settle();
    const options = { focus, contact };
    if (!enabled || isReduced() || target === index) { finish(target, options); return; }
    state = 'settling';
    const motion = { target, options, started: null, switched: false };
    animation = motion;
    function tick(now) {
      frame = 0;
      if (animation !== motion) return;
      if (isBlocked()) { settle(); return; }
      if (motion.started === null) motion.started = now;
      const progress = clamp((now - motion.started) / MOTION.jumpDuration, 0, 1);
      if (progress >= 0.5 && !motion.switched) {
        motion.switched = true;
        index = position = target;
        syncSemantics();
      }
      fade = progress < 0.5 ? 1 - easeOut(progress * 2) : easeOut((progress - 0.5) * 2);
      render();
      if (progress < 1) frame = requestAnimationFrame(tick);
      else { finish(target, options); processPending(); }
    }
    frame = requestAnimationFrame(tick);
  }

  function sample(event) {
    gesture.samples.push({ time: event.timeStamp, position: gesture.startY - event.clientY });
    // Keep one sample before the window for interpolation at its boundary.
    while (gesture.samples.length > 2 && gesture.samples[1].time < event.timeStamp - MOTION.velocityWindow) gesture.samples.shift();
  }

  function hasSelection() {
    const selection = window.getSelection();
    return selection && !selection.isCollapsed;
  }

  function trackTouchDown(event) {
    if (event.pointerType !== 'touch') return;
    touchContacts.add(event.pointerId);
    if (touchContacts.size > 1) {
      multiTouch = true;
      cancelGesture();
    }
  }

  function trackTouchEnd(event) {
    if (event.pointerType !== 'touch') return;
    touchContacts.delete(event.pointerId);
    if (!touchContacts.size) multiTouch = false;
    // Pending input never acquires explicit capture. Clear it even when a
    // browser delivers the ending event outside the stage.
    if (gesture?.pointerId === event.pointerId && state !== 'dragging') cancelGesture(event);
  }

  document.addEventListener('pointerdown', trackTouchDown, true);
  document.addEventListener('pointerup', trackTouchEnd, true);
  document.addEventListener('pointercancel', (event) => {
    trackTouchEnd(event);
    cancelGesture(event);
  }, true);

  stage.addEventListener('pointerdown', (event) => {
    // This also handles synthetic events that do not traverse document capture.
    // Track contacts before every eligibility guard, including interactive UI.
    trackTouchDown(event);
    if (!enabled || isBlocked() || multiTouch || gesture || state !== 'idle' || !event.isPrimary || event.button !== 0) return;
    const excluded = event.pointerType === 'mouse' ? MOUSE_EXCLUDED_START : INTERACTIVE_START;
    if (event.target.closest(excluded) || hasSelection()) return;
    const targetCard = event.target.closest('.card');
    if (targetCard && targetCard !== cards[index]) return;
    // Native mouse selection starts on pointerdown, before movement reaches the
    // drag dead zone. Prevent it only on eligible blank space; text-origin
    // gestures have already returned above and retain their native selection.
    if (event.pointerType === 'mouse') event.preventDefault();
    gesture = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      deadline: event.timeStamp + TOUCH_HOLD_DELAY,
      origin: index,
      startX: event.clientX,
      startY: event.clientY,
      distance: travelDistance(height, getPreset()),
      samples: [{ time: event.timeStamp, position: 0 }],
    };
    if (event.pointerType === 'touch') {
      const candidate = gesture;
      holdTimer = setTimeout(() => {
        holdTimer = 0;
        if (gesture === candidate && state !== 'dragging') cancelGesture();
      }, TOUCH_HOLD_DELAY);
    }
  });

  stage.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) { cancelGesture(event); return; }
    if (isBlocked()) { settle(); return; }
    if (hasSelection() || (gesture.pointerType === 'touch' && state !== 'dragging' && event.timeStamp >= gesture.deadline)) { cancelGesture(event); return; }
    const horizontal = event.clientX - gesture.startX;
    const travel = gesture.startY - event.clientY;
    sample(event);
    if (state !== 'dragging') {
      if (Math.hypot(horizontal, travel) < MOTION.deadZone) return;
      if (Math.abs(travel) < Math.abs(horizontal) * MOTION.verticalRatio) { releaseCapture(); return; }
      state = 'dragging';
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = 0;
      stage.classList?.add('is-deck-dragging');
      stage.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    position = positionFromTravel(gesture.origin, travel, gesture.distance, cards.length);
    queueRender();
  }, { passive: false });

  stage.addEventListener('pointerup', (event) => {
    trackTouchEnd(event);
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (state !== 'dragging') { releaseCapture(); return; }
    sample(event);
    position = positionFromTravel(gesture.origin, gesture.startY - event.clientY, gesture.distance, cards.length);
    const target = releaseTarget({ position, origin: gesture.origin, velocity: releaseVelocity(gesture.samples), distance: gesture.distance, count: cards.length });
    releaseCapture();
    animateTo(target, { focus: false });
  });

  function cancelGesture(event) {
    if (!gesture || (event && event.pointerId !== gesture.pointerId)) return;
    const origin = gesture.origin;
    pending = null;
    releaseCapture();
    finish(origin, {}, false);
  }
  stage.addEventListener('pointercancel', (event) => { trackTouchEnd(event); cancelGesture(event); });
  stage.addEventListener('lostpointercapture', (event) => {
    // Touch's implicit capture belongs to the touched descendant. Its loss
    // bubbles when capture transfers to the stage and is not a cancellation.
    if (event.target === stage && !stage.hasPointerCapture(event.pointerId)) cancelGesture(event);
  });
  stage.addEventListener('pointerleave', (event) => { if (state !== 'dragging') cancelGesture(event); });
  stage.addEventListener('contextmenu', () => cancelGesture());
  stage.addEventListener('selectstart', (event) => {
    if (gesture && state === 'dragging') event.preventDefault();
    else cancelGesture();
  });
  document.addEventListener('selectionchange', () => { if (hasSelection()) cancelGesture(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      touchContacts.clear();
      multiTouch = false;
      if (gesture) cancelGesture();
      else settle();
    }
  });

  return { setEnabled, measure, navigate, jump, settle, get index() { return index; }, get position() { return position; }, get state() { return state; } };
}
