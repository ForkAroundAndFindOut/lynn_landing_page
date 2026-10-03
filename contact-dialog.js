/** A page-lifetime, local-only contact demonstration. No draft leaves this DOM. */
export function setupContact({ dialog, opener, sourceCard, beforeOpen, onClose, isReduced = () => false }) {
  const query = (selector) => dialog.querySelector(selector);
  const content = query('.dialog-content');
  const title = query('#dialog-title');
  const form = query('#contact-form');
  const fieldset = query('#contact-fields');
  const summary = query('#error-summary');
  const status = query('#dialog-status');
  const fields = Object.fromEntries(['name', 'email', 'organization', 'message'].map((name) => [name, query(`#${name}`)]));
  const views = { details: query('#details-view'), review: query('#review-view'), complete: query('#complete-view') };
  const surface = document.createElement('div');
  surface.className = 'dialog-surface';
  surface.setAttribute('aria-hidden', 'true');
  surface.hidden = true;
  dialog.append(surface);

  const errors = new Map();
  let phase = 'closed';
  let generation = 0;
  let animations = [];
  let previousOverflow = null;
  let backdropPointer = null;
  let viewportFrame = 0;

  function focus(element) {
    element?.focus({ preventScroll: true });
  }

  function updateViewport() {
    viewportFrame = 0;
    const viewport = window.visualViewport;
    dialog.style.setProperty('--visible-height', `${viewport?.height ?? window.innerHeight}px`);
    dialog.style.setProperty('--visible-top', `${viewport?.offsetTop ?? 0}px`);
  }

  function scheduleViewportUpdate() {
    if (phase !== 'closed' && !viewportFrame) viewportFrame = requestAnimationFrame(updateViewport);
  }

  function cancelAnimations() {
    animations.forEach((animation) => animation.cancel());
    animations = [];
    content.style.removeProperty('opacity');
    surface.hidden = true;
  }

  function surfacePose(source, target) {
    return `translate(${source.left - target.left}px, ${source.top - target.top}px) scale(${source.width / target.width}, ${source.height / target.height})`;
  }

  function prepareSurface(rect) {
    Object.assign(surface.style, {
      left: `${rect.left}px`, top: `${rect.top}px`,
      width: `${rect.width}px`, height: `${rect.height}px`,
    });
    surface.hidden = false;
  }

  function finishOpen(token) {
    if (token !== generation || phase !== 'opening') return;
    cancelAnimations();
    phase = 'open';
    dialog.dataset.phase = phase;
  }

  function finishClose() {
    if (phase === 'closed') return;
    generation += 1;
    cancelAnimations();
    phase = 'closed';
    delete dialog.dataset.phase;
    backdropPointer = null;
    if (dialog.open) dialog.close();
    if (previousOverflow !== null) {
      document.documentElement.style.overflow = previousOverflow;
      previousOverflow = null;
    }
    onClose?.();
    focus(opener);
  }

  function open() {
    if (phase === 'open' || phase === 'opening') return;
    beforeOpen?.();
    const source = sourceCard.getBoundingClientRect();
    const token = ++generation;
    cancelAnimations();
    updateViewport();
    if (previousOverflow === null) {
      previousOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
    }
    phase = 'opening';
    dialog.dataset.phase = phase;
    if (!dialog.open) dialog.showModal();
    // Reopening a long review starts at its title without losing its view or draft.
    dialog.scrollTop = 0;
    focus(title);
    const target = dialog.getBoundingClientRect();
    if (isReduced() || !surface.animate || !source.width || !source.height || !target.width || !target.height) {
      finishOpen(token);
      return;
    }
    prepareSurface(target);
    animations = [
      surface.animate([{ transform: surfacePose(source, target) }, { transform: 'none' }], {
        duration: 320, easing: 'cubic-bezier(.18,.72,.24,1)', fill: 'both',
      }),
      content.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 210, delay: 90, easing: 'ease-out', fill: 'both',
      }),
    ];
    Promise.allSettled(animations.map((animation) => animation.finished)).then(() => finishOpen(token));
  }

  function close() {
    if (phase === 'closed' || phase === 'closing') return;
    const token = ++generation;
    cancelAnimations();
    const source = sourceCard.getBoundingClientRect();
    const target = dialog.getBoundingClientRect();
    phase = 'closing';
    dialog.dataset.phase = phase;
    if (isReduced() || !surface.animate || !source.width || !source.height || !target.width || !target.height) {
      finishClose();
      return;
    }
    prepareSurface(target);
    animations = [
      surface.animate([{ transform: 'none' }, { transform: surfacePose(source, target) }], {
        duration: 300, easing: 'cubic-bezier(.24,.66,.3,1)', fill: 'both',
      }),
      content.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, easing: 'ease-out', fill: 'both' }),
    ];
    Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (token === generation && phase === 'closing') finishClose();
    });
  }

  function refreshMotion() {
    if (!isReduced()) return;
    if (phase === 'opening') finishOpen(generation);
    else if (phase === 'closing') finishClose();
  }

  function errorFor(name) {
    const value = fields[name].value.trim();
    if (name === 'name' && !value) return 'Please enter your name.';
    if (name === 'email' && !value) return 'Please enter your email address.';
    if (name === 'email' && fields.email.validity.typeMismatch) return 'Enter an email address such as name@example.com.';
    if (name === 'message' && !value) return 'Please add a message.';
    return '';
  }

  function updateFieldError(name) {
    const message = errorFor(name);
    const field = fields[name];
    const error = query(`#${name}-error`);
    const describedBy = new Set((field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
    if (message) {
      errors.set(name, message);
      field.setAttribute('aria-invalid', 'true');
      describedBy.add(error.id);
    } else {
      errors.delete(name);
      field.removeAttribute('aria-invalid');
      describedBy.delete(error.id);
    }
    if (describedBy.size) field.setAttribute('aria-describedby', [...describedBy].join(' '));
    else field.removeAttribute('aria-describedby');
    error.textContent = message;
    error.hidden = !message;
  }

  function updateSummary() {
    summary.replaceChildren();
    summary.hidden = !errors.size;
    if (!errors.size) return;
    const heading = document.createElement('p');
    heading.textContent = 'Please check these details:';
    const list = document.createElement('ul');
    for (const [name, message] of errors) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${name}`;
      link.textContent = message;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        fields[name].focus();
      });
      item.append(link);
      list.append(item);
    }
    summary.append(heading, list);
  }

  function validate() {
    ['name', 'email', 'message'].forEach(updateFieldError);
    updateSummary();
    return errors.size === 0;
  }

  function showView(view, focusTarget) {
    for (const [name, element] of Object.entries(views)) element.hidden = name !== view;
    dialog.scrollTop = 0;
    // Let the dialog reveal this target when the keyboard leaves a short viewport.
    focusTarget?.focus();
  }

  function review(event) {
    event.preventDefault();
    if (!validate()) {
      showView('details', summary);
      status.textContent = 'Some details need your attention.';
      return;
    }
    for (const [name, field] of Object.entries(fields)) {
      query(`[data-review="${name}"]`).textContent = field.value.trim() || 'Not provided';
    }
    showView('review', query('#review-title'));
    status.textContent = 'Review your inquiry. Nothing has been sent.';
  }

  // Install interception before enabling any field, including implicit Enter submission.
  form.addEventListener('submit', review);
  fieldset.disabled = false;
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  for (const name of ['name', 'email', 'message']) {
    fields[name].addEventListener('input', () => {
      if (errors.has(name)) {
        updateFieldError(name);
        updateSummary();
      }
    });
  }
  query('#edit-details').addEventListener('click', () => {
    showView('details', title);
    status.textContent = 'Your details are ready to edit.';
  });
  query('#finish-demo').addEventListener('click', () => {
    if (!validate()) {
      showView('details', summary);
      status.textContent = 'Some details need your attention.';
      return;
    }
    showView('complete', query('#complete-title'));
    status.textContent = 'Demo complete. Nothing was sent.';
  });
  query('#edit-again').addEventListener('click', () => {
    showView('details', title);
    status.textContent = 'Your saved draft is ready to edit on this page.';
  });
  opener.addEventListener('click', open);
  query('#close-contact').addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
    const focusable = [...dialog.querySelectorAll('a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]')]
      .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]') && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
    if (!focusable.length) {
      event.preventDefault();
      focus(title);
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    // Explicit wrapping prevents native dialog tab order from pausing on BODY.
    // Other keys and middle-of-form Tab movement retain their native behavior.
    if (active === title || (event.shiftKey ? active === first : active === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });
  dialog.addEventListener('close', () => {
    // A delayed native close event must not close a newly reopened dialog.
    if (!dialog.open) finishClose();
  });
  function isOutside(event) {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  }
  dialog.addEventListener('pointerdown', (event) => {
    backdropPointer = event.isPrimary && event.button === 0 && event.target === dialog && isOutside(event) ? event.pointerId : null;
  });
  dialog.addEventListener('pointerup', (event) => {
    const shouldClose = backdropPointer === event.pointerId && event.target === dialog && isOutside(event);
    backdropPointer = null;
    if (shouldClose) close();
  });
  dialog.addEventListener('pointercancel', () => { backdropPointer = null; });
  window.addEventListener('resize', scheduleViewportUpdate);
  window.visualViewport?.addEventListener('resize', scheduleViewportUpdate);
  window.visualViewport?.addEventListener('scroll', scheduleViewportUpdate);

  // The no-script fallback stays disabled until the complete interaction is ready.
  opener.disabled = false;
  return { open, close, refreshMotion, get isOpen() { return phase !== 'closed'; } };
}
