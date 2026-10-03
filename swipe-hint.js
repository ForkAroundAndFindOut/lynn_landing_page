// Experimental child-branch enhancement. The navigation controls and semantic
// instructions remain available; this decorative cue never handles input.
export function setupSwipeHint({ stage, cue, dialog, isBlocked, isReduced }) {
  if (!cue) return;
  let timer = 0;
  const firstCard = stage.querySelector('.card');
  const reviewPanel = document.querySelector('#review-settings');
  const activePointers = new Set();
  const hasSelection = () => Boolean(window.getSelection()?.toString());

  const eligible = () => !document.hidden && document.hasFocus() && !dialog.open && !reviewPanel?.open && activePointers.size === 0
    && !hasSelection() && !isBlocked() && !isReduced()
    && document.body.dataset.mode === 'deck'
    && stage.dataset.deckState === 'idle'
    && Number(stage.dataset.deckPosition) === 0
    && firstCard.hasAttribute('data-active');

  function hide() {
    if (timer) clearTimeout(timer);
    timer = 0;
    delete cue.dataset.visible;
  }
  function schedule() {
    if (!eligible() || timer || cue.dataset.visible === 'true') return;
    timer = setTimeout(() => {
      timer = 0;
      if (eligible()) cue.dataset.visible = 'true';
    }, 5000);
  }
  function refresh() {
    if (!eligible()) { hide(); return; }
    schedule();
  }

  // Input starts a fresh idle interval. Advancing off the first card hides the
  // cue through eligibility; returning to the first card can start a new one.
  // The cue itself never handles input or steals focus.
  function restartIdleInterval() {
    hide();
    schedule();
  }
  document.addEventListener('pointerdown', event => {
    activePointers.add(event.pointerId);
    restartIdleInterval();
  }, { capture: true, passive: true });
  for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, event => {
    activePointers.delete(event.pointerId);
    restartIdleInterval();
  }, { capture: true, passive: true });
  for (const type of ['wheel', 'keydown']) document.addEventListener(type, restartIdleInterval, { capture: true, passive: true });
  if (!('PointerEvent' in window)) {
    document.addEventListener('touchstart', () => { activePointers.add('touch'); restartIdleInterval(); }, { capture: true, passive: true });
    for (const type of ['touchend', 'touchcancel']) document.addEventListener(type, () => { activePointers.delete('touch'); restartIdleInterval(); }, { capture: true, passive: true });
  }
  document.addEventListener('selectionchange', () => {
    if (hasSelection()) hide();
    else restartIdleInterval();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) activePointers.clear();
    refresh();
  });
  window.addEventListener('blur', () => {
    activePointers.clear();
    refresh();
  });
  window.addEventListener('focus', restartIdleInterval);
  const observer = new MutationObserver(refresh);
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-mode', 'data-reduced'] });
  observer.observe(stage, { attributes: true, attributeFilter: ['data-deck-state', 'data-deck-position'] });
  observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  if (reviewPanel) observer.observe(reviewPanel, { attributes: true, attributeFilter: ['open'] });
  refresh();
}
