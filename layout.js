// Responsive layout owns geometry. Pointer rendering never measures the DOM.
export function setupLayout({ stage, cards, deck, settings, isBlocked, onMode }) {
  let mode = 'flow';
  let frame = 0;
  let readAsPage = new URLSearchParams(location.search).get('view') === 'page';
  let initialized = false;
  const entered = new Set();
  const entrances = new Map();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting || entered.has(entry.target)) continue;
      entered.add(entry.target);
      if (mode !== 'flow' || settings.reduced || settings.desktop !== 'staggered' || innerWidth < 900) continue;
      const i = cards.indexOf(entry.target);
      const direction = (i - 1 + 3) % 3;
      const transform = i === 0 ? 'none' : direction === 2 ? 'translateY(28px) rotate(2deg)' : `translateX(${direction === 0 ? -28 : 28}px) rotate(${direction === 0 ? -2 : 2}deg)`;
      const animation = entry.target.animate([{ opacity: 0, transform }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
      entrances.set(entry.target, animation);
      animation.finished.then(() => entrances.delete(entry.target)).catch(() => {});
    }
  }, { threshold: 0.08 });
  cards.forEach(card => observer.observe(card));

  function refresh() {
    frame = 0;
    if (isBlocked()) return;
    deck.settle();
    entrances.forEach(animation => animation.cancel());
    entrances.clear();
    const previous = mode;
    const viewportHeight = window.visualViewport?.height ?? innerHeight;
    const viewportWidth = window.visualViewport?.width ?? innerWidth;
    const narrow = innerWidth < 900;
    const eligible = narrow && viewportHeight >= 540 && !settings.reduced && !readAsPage;
    document.body.dataset.reduced = String(settings.reduced);
    document.body.dataset.desktop = settings.desktop;
    let reason = settings.reduced ? 'Reduced motion: all content in document flow.' : readAsPage ? 'Reading view: native page scrolling.' : 'Desktop: native page scrolling.';
    if (eligible) {
      document.body.dataset.mode = 'deck';
      const headerHeight = document.querySelector('.site-header').offsetHeight;
      const stageHeight = Math.max(240, viewportHeight - headerHeight - 126);
      const cardWidth = Math.min(viewportWidth - 32, 590);
      stage.style.setProperty('--stage-height', `${stageHeight}px`);
      stage.style.setProperty('--card-width', `${cardWidth}px`);
      stage.style.setProperty('--card-height', `${Math.min(stageHeight - 46, Math.max(cardWidth, 450))}px`);
      // All six semantic cards stay in the document; measure content before enabling.
      const neededHeight = Math.max(...cards.map(card => card.scrollHeight + 2));
      const currentHeight = cards[0].offsetHeight;
      if (neededHeight > currentHeight) stage.style.setProperty('--card-height', `${neededHeight}px`);
      if (neededHeight <= stageHeight - 42) {
        mode = 'deck';
        reason = 'Card view: drag open space vertically, or use the arrows.';
      } else {
        mode = 'flow';
        reason = 'Reading view keeps enlarged or compact-screen content fully visible.';
      }
    } else {
      mode = 'flow';
      if (narrow && viewportHeight < 540) reason = 'Short screen: native page scrolling.';
    }
    document.body.dataset.mode = mode;
    deck.setEnabled(mode === 'deck');
    const navigation = document.querySelector('.deck-navigation');
    if (!narrow && navigation.contains(document.activeElement)) cards[deck.index].querySelector('h1,h2').focus({ preventScroll: true });
    navigation.hidden = !narrow;
    const focused = document.activeElement;
    if (focused && focused !== document.body && !focused.getClientRects().length) cards[deck.index].querySelector('h1,h2').focus({ preventScroll: true });
    const readButton = document.querySelector('#read-mode');
    readButton.textContent = mode === 'deck' ? 'Read as page' : 'Use card view';
    readButton.disabled = settings.reduced || viewportHeight < 540 || (!readAsPage && mode !== 'deck');
    document.querySelector('#mode-note').textContent = reason;
    if (previous !== mode && initialized) {
      if (mode === 'flow') cards[deck.index].scrollIntoView({ block: 'start' });
      else window.scrollTo(0, 0);
    }
    if (!initialized && mode === 'deck' && deck.index === 0 && !settings.reduced) cards[0].animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    initialized = true;
    onMode(mode);
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(refresh); }
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  // Font enlargement can occur independently of a viewport resize.
  const fontProbe = document.createElement('span');
  fontProbe.setAttribute('aria-hidden', 'true');
  Object.assign(fontProbe.style, { position: 'absolute', visibility: 'hidden', width: '1em', height: '1em', pointerEvents: 'none' });
  document.body.append(fontProbe);
  new ResizeObserver(schedule).observe(fontProbe);
  return { refresh, get mode() { return mode; }, toggleReading() { readAsPage = !readAsPage; refresh(); } };
}
