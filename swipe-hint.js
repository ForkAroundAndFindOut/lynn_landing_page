// Experimental child-branch enhancement. The navigation controls and semantic
// instructions remain available; this decorative cue never handles input.
export function setupSwipeHint({ stage, cue, dialog, isBlocked, isReduced }) {
  if (!cue) return;
  let timer = 0;
  let dismissed = false;
  const firstCard = stage.querySelector('.card');

  const eligible = () => !dismissed && !document.hidden && !dialog.open && !isBlocked() && !isReduced()
    && document.body.dataset.mode === 'deck'
    && stage.dataset.deckState === 'idle'
    && Number(stage.dataset.deckPosition) === 0
    && firstCard.hasAttribute('data-active');

  function hide() {
    if (timer) clearTimeout(timer);
    timer = 0;
    delete cue.dataset.visible;
  }
  function dismiss() { dismissed = true; hide(); }
  function refresh() {
    if (stage.dataset.deckState && (stage.dataset.deckState !== 'idle' || Number(stage.dataset.deckPosition) !== 0)) {
      dismiss();
      return;
    }
    if (!eligible()) { hide(); return; }
    if (timer || cue.dataset.visible === 'true') return;
    timer = setTimeout(() => {
      timer = 0;
      if (eligible()) cue.dataset.visible = 'true';
    }, 5000);
  }

  // A deliberate interaction ends the cue for this page load. No cookie or
  // contact value is written, and no event is cancelled.
  for (const type of ['pointerdown', 'wheel', 'keydown']) document.addEventListener(type, dismiss, { capture: true, passive: true });
  document.addEventListener('visibilitychange', refresh);
  const observer = new MutationObserver(refresh);
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-mode', 'data-reduced'] });
  observer.observe(stage, { attributes: true, attributeFilter: ['data-deck-state', 'data-deck-position'] });
  observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  refresh();
}
