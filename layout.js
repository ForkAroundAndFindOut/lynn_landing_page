// Responsive layout owns geometry. Pointer rendering never measures the DOM.
export function setupLayout({ stage, cards, deck, settings, isBlocked, onMode }) {
  let mode = 'flow';
  let frame = 0;
  let readingOverride;
  let localView;
  const legacyReadAsPage = new URLSearchParams(location.search).get('view') === 'page';
  let initialized = false;
  const entered = new Set();
  const entrances = new Map();
  let observer;
  let observerKey;
  let observerGeneration = 0;
  let initialEntrance;

  function revealCard(card) {
    if (!card) return;
    entered.add(card);
    delete card.dataset.entrance;
    entrances.get(card)?.cancel();
    entrances.delete(card);
    observer?.unobserve(card);
  }

  function animateEntrance(card) {
    if (entered.has(card)) return;
    if (mode !== 'flow' || settings.reduced || settings.desktop !== 'staggered' || innerWidth < 900 || isBlocked()) { revealCard(card); return; }
    entered.add(card);
    observer?.unobserve(card);
    const i = cards.indexOf(card);
    const direction = (i - 1 + 3) % 3;
    const transform = i === 0 ? 'none' : direction === 2 ? 'translateY(28px) rotate(2deg)' : `translateX(${direction === 0 ? -28 : 28}px) rotate(${direction === 0 ? -2 : 2}deg)`;
    // Pending CSS is cleared only after an animation with backwards fill owns
    // opacity, so the delay cannot flash visible content before the fade.
    const animation = card.animate([{ opacity: 0, transform }, { opacity: 1, transform: 'none' }], { delay: 80, duration: 380, easing: 'ease-out', fill: 'backwards' });
    entrances.set(card, animation);
    delete card.dataset.entrance;
    animation.finished.then(() => { if (entrances.get(card) === animation) entrances.delete(card); }).catch(() => {});
  }

  function refreshEntrances(viewportHeight) {
    const eligible = mode === 'flow' && !settings.reduced && settings.desktop === 'staggered' && innerWidth >= 900 && typeof IntersectionObserver !== 'undefined' && Boolean(cards[0]?.animate);
    const inset = Math.round(viewportHeight * 0.15);
    const key = `${mode}:${eligible}:${inset}`;
    if (key === observerKey) return;
    observerKey = key;
    observer?.disconnect();
    const generation = ++observerGeneration;
    entrances.forEach(animation => animation.cancel());
    entrances.clear();
    if (!eligible) {
      for (const card of cards) {
        // Content actually in view is already read; switching presentation
        // must not hide it again when animated desktop mode is restored.
        const rect = card.getBoundingClientRect();
        if (mode === 'flow' && rect.top < viewportHeight && rect.bottom > 0) entered.add(card);
        delete card.dataset.entrance;
      }
    }
    if (mode !== 'flow' || typeof IntersectionObserver === 'undefined') return;
    observer = new IntersectionObserver(entries => {
      if (generation !== observerGeneration || mode !== 'flow') return;
      for (const entry of entries) {
        // Edge adjacency counts with threshold zero; ignoring a zero ratio can
        // miss the next threshold notification and strand a pending card.
        if (!entry.isIntersecting) continue;
        if (eligible) animateEntrance(entry.target);
        else revealCard(entry.target);
      }
    }, { rootMargin: eligible ? `0px 0px -${inset}px 0px` : '0px', threshold: 0 });
    for (const card of cards) {
      if (entered.has(card) || card.getBoundingClientRect().bottom <= 0) { revealCard(card); continue; }
      if (eligible) card.dataset.entrance = 'pending';
      observer.observe(card);
    }
  }

  function refresh() {
    frame = 0;
    // Reduced motion also cancels background entrances during a locked form.
    if (settings.reduced) {
      observer?.disconnect();
      observerKey = undefined;
      observerGeneration += 1;
      initialEntrance?.cancel();
      entrances.forEach(animation => animation.cancel());
      entrances.clear();
      cards.forEach(card => { delete card.dataset.entrance; });
    }
    if (isBlocked()) return;
    deck.settle();
    const previous = mode;
    const viewportHeight = window.visualViewport?.height ?? innerHeight;
    const viewportWidth = window.visualViewport?.width ?? innerWidth;
    const narrow = viewportWidth < 900;
    const configuredView = settings.view ?? (legacyReadAsPage ? 'page' : 'auto');
    const selectedView = ['auto', 'deck', 'page'].includes(configuredView) ? configuredView : 'auto';
    const preferredView = localView ?? selectedView;
    const requestedView = readingOverride ?? preferredView;
    const eligible = viewportHeight >= 540 && !settings.reduced && requestedView !== 'page' && (narrow || requestedView === 'deck');
    document.body.dataset.reduced = String(settings.reduced);
    document.body.dataset.desktop = settings.desktop;
    let reason = settings.reduced ? 'Reduced motion: all content in document flow.' : requestedView === 'page' ? 'Reading view: native page scrolling.' : 'Desktop: native page scrolling.';
    document.body.dataset.deckWide = String(!narrow && eligible);
    if (eligible) {
      document.body.dataset.mode = 'deck';
      const headerHeight = document.querySelector('.site-header').offsetHeight;
      const stageHeight = Math.max(240, viewportHeight - headerHeight - 126);
      const availableWidth = viewportWidth - (!narrow ? 360 : 0);
      const cardWidth = Math.min(availableWidth - 32, 590);
      stage.style.setProperty('--stage-height', `${stageHeight}px`);
      stage.style.setProperty('--card-width', `${cardWidth}px`);
      stage.style.setProperty('--card-height', `${Math.min(stageHeight - 46, Math.max(cardWidth, 450))}px`);
      // All six semantic cards stay in the document; measure content before enabling.
      const neededHeight = Math.max(...cards.map(card => card.scrollHeight + 2));
      const currentHeight = cards[0].offsetHeight;
      if (neededHeight > currentHeight) stage.style.setProperty('--card-height', `${neededHeight}px`);
      if (neededHeight <= stageHeight - 42) {
        mode = 'deck';
        reason = 'Card view: swipe or scroll vertically, or use the arrows.';
      } else {
        mode = 'flow';
        reason = 'Reading view keeps enlarged or compact-screen content fully visible.';
      }
    } else {
      mode = 'flow';
      if (narrow && viewportHeight < 540) reason = 'Short screen: native page scrolling.';
    }
    document.body.dataset.mode = mode;
    document.body.dataset.deckWide = String(!narrow && mode === 'deck');
    deck.setEnabled(mode === 'deck');
    refreshEntrances(viewportHeight);
    const navigation = document.querySelector('.deck-navigation');
    const deckWide = !narrow && mode === 'deck';
    if (!narrow && !deckWide && navigation.contains(document.activeElement)) cards[deck.index].querySelector('h1,h2').focus({ preventScroll: true });
    navigation.hidden = !narrow && !deckWide;
    const focused = document.activeElement;
    if (focused && focused !== document.body && !focused.getClientRects().length) cards[deck.index].querySelector('h1,h2').focus({ preventScroll: true });
    const readButton = document.querySelector('#read-mode');
    readButton.textContent = mode === 'deck' ? 'Read as page' : 'Use card view';
    readButton.disabled = settings.reduced || viewportHeight < 540;
    document.querySelector('#mode-note').textContent = reason;
    if (previous !== mode && initialized) {
      if (mode === 'flow') cards[deck.index].scrollIntoView({ block: 'start' });
      else window.scrollTo(0, 0);
    }
    if (!initialized && mode === 'deck' && deck.index === 0 && !settings.reduced) initialEntrance = cards[0].animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    initialized = true;
    onMode(mode);
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(refresh); }
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  stage.addEventListener('focusin', event => { if (mode === 'flow') revealCard(event.target.closest('.card')); });
  // Font enlargement can occur independently of a viewport resize.
  const fontProbe = document.createElement('span');
  fontProbe.setAttribute('aria-hidden', 'true');
  Object.assign(fontProbe.style, { position: 'absolute', visibility: 'hidden', width: '1em', height: '1em', pointerEvents: 'none' });
  document.body.append(fontProbe);
  new ResizeObserver(schedule).observe(fontProbe);
  function setView(view) {
    if (!['auto', 'deck', 'page'].includes(view)) return;
    readingOverride = undefined;
    if (typeof settings.setView === 'function') settings.setView(view);
    else localView = view;
    refresh();
  }
  function toggleReading() {
    // Keep the saved selector preference intact. The button temporarily switches
    // presentation, and the selected preference resumes after the next toggle.
    readingOverride = mode === 'deck' ? 'page' : 'deck';
    refresh();
  }
  return { refresh, revealCard, setView, get mode() { return mode; }, toggleReading };
}
