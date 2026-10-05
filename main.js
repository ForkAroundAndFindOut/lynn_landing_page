import { createDeck } from './deck-controller.js';
import { setupContact } from './contact-dialog.js';
import { setupSettings } from './demo-settings.js';
import { setupLayout } from './layout.js';
import { setupSwipeHint } from './swipe-hint.js';

const restartingReview = performance.getEntriesByType('navigation')[0]?.type === 'reload';
if (restartingReview) {
  const restoration = history.scrollRestoration;
  history.scrollRestoration = 'manual';
  history.replaceState(null, '', `${location.pathname}${location.search}#top`);
  window.scrollTo(0, 0);
  window.addEventListener('pageshow', () => requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    history.scrollRestoration = restoration;
  }), { once: true });
}

const stage = document.querySelector('#deck-stage');
const cards = [...stage.querySelectorAll('.card')];
const previous = document.querySelector('#previous-card');
const next = document.querySelector('#next-card');
const top = document.querySelector('#go-top');
const opener = document.querySelector('#open-contact');
let layout;
let contact;
let debugObserver;
let reviewFrame = 0;
let readingFrame = 0;
let trackReading = false;
const settings = setupSettings(({ kind = 'layout' } = {}) => {
  if (kind === 'layout' || kind === 'motion') {
    deck.settle();
    contact?.refreshMotion();
    layout.refresh();
  }
  updateControls();
});

function updateControls() {
  const target = layout?.mode === 'deck' ? deck.requestedIndex : deck.index;
  previous.disabled = target === 0;
  top.disabled = target === 0 && deck.position === 0;
  next.disabled = target === cards.length - 1;
  const testPrevious = document.querySelector('#tuning-previous');
  const testNext = document.querySelector('#tuning-next');
  if (testPrevious) testPrevious.disabled = previous.disabled;
  if (testNext) testNext.disabled = next.disabled;
  document.querySelector('#position').innerHTML = `${String(target + 1).padStart(2, '0')} <i>/</i> 06`;
  updateDebug();
}
function updateDebug() {
  const output = document.querySelector('#debug-state');
  output.hidden = !settings.debug;
  const remaining = layout?.mode === 'deck' ? deck.gateRemaining : 0;
  const gateStatus = document.querySelector('#gate-status');
  if (gateStatus) gateStatus.textContent = remaining > 0 ? `Next request in ${(remaining / 1000).toFixed(2)} s` : 'Ready for next request';
  if (settings.debug) {
    output.textContent = `${layout?.mode ?? 'flow'} · ${deck.state}\nposition ${deck.position.toFixed(3)} · requested ${deck.requestedIndex + 1}\ngate ${(remaining / 1000).toFixed(2)} s · ${deck.lastRejection || 'no rejected request'}`;
  }
  if (!reviewFrame && (remaining > 0 || deck.state === 'settling')) reviewFrame = requestAnimationFrame(() => { reviewFrame = 0; updateDebug(); });
}
const deck = createDeck({
  stage, cards,
  isBlocked: () => Boolean(contact?.isOpen),
  getPreset: () => settings.preset,
  getTuning: () => settings.tuning,
  isReduced: () => settings.reduced,
  onRequest() { updateControls(); },
  onChange(index, { focus, contact: focusContact }) {
    updateControls();
    const heading = cards[index].querySelector('h1,h2');
    document.querySelector('#card-status').textContent = `Card ${index + 1} of ${cards.length}: ${heading.textContent}`;
    if (focus) {
      trackReading = false;
      layout?.revealCard(cards[index]);
      const target = focusContact ? opener : heading;
      if (layout?.mode === 'flow') cards[index].scrollIntoView({ block: 'start' });
      target.focus({ preventScroll: true });
    }
    history.replaceState(null, '', `${location.pathname}${location.search}#${cards[index].id}`);
  },
});
contact = setupContact({ dialog: document.querySelector('#contact-dialog'), opener, sourceCard: cards[5], beforeOpen: () => deck.settle(), onClose: () => layout.refresh(), isReduced: () => settings.reduced });
layout = setupLayout({ stage, cards, deck, settings, isBlocked: () => contact.isOpen, onMode: () => { trackReading = false; updateControls(); } });
function navigate(delta) {
  if (contact.isOpen) return;
  if (layout.mode === 'deck') deck.navigate(delta);
  else deck.jump(Math.min(5, Math.max(0, deck.index + delta)));
}
previous.addEventListener('click', () => navigate(-1));
next.addEventListener('click', () => navigate(1));
top.addEventListener('click', () => deck.jump(0));
document.querySelector('#read-mode').addEventListener('click', () => {
  settings.setView(layout.mode === 'deck' ? 'page' : 'deck');
  cards[deck.index].querySelector('h1,h2').focus({ preventScroll: true });
});
document.querySelector('#tuning-previous')?.addEventListener('click', () => navigate(-1));
document.querySelector('#tuning-next')?.addEventListener('click', () => navigate(1));
document.querySelector('#tuning-top')?.addEventListener('click', () => deck.jump(0));
document.addEventListener('click', event => {
  const anchor = event.target.closest('a[href^="#"]');
  if (!anchor || contact.isOpen) return;
  const index = cards.findIndex(card => `#${card.id}` === anchor.getAttribute('href'));
  if (index < 0) return;
  event.preventDefault();
  deck.jump(index, { focus: true, contact: index === 5 });
});
document.addEventListener('keydown', event => {
  if (contact.isOpen || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('input,textarea,select,[contenteditable]')) return;
  if (!event.target.closest('#deck-stage,.deck-navigation')) return;
  if (event.key === 'ArrowUp') { event.preventDefault(); navigate(-1); }
  if (event.key === 'ArrowDown') { event.preventDefault(); navigate(1); }
  if (event.key === 'Home') { event.preventDefault(); deck.jump(0); }
  if (event.key === 'End') { event.preventDefault(); deck.jump(5, { contact: true }); }
});
function followHash(focus = false) {
  const index = cards.findIndex(card => `#${card.id}` === location.hash);
  if (index >= 0) { deck.jump(index, { focus, contact: index === 5 }); if (layout.mode === 'flow') cards[index].scrollIntoView({ block: 'start' }); }
}
window.addEventListener('hashchange', () => followHash(true));
// Only native user scrolling changes the reading position. Programmatic section
// alignment must not select an adjacent staggered card or a clamped bottom row.
for (const type of ['wheel', 'touchmove', 'pointerdown']) window.addEventListener(type, () => { if (layout.mode === 'flow' && !contact.isOpen) trackReading = true; }, { passive: true });
window.addEventListener('keydown', event => { if (['PageDown', 'PageUp', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key) && layout.mode === 'flow' && !contact.isOpen) trackReading = true; });
window.addEventListener('scroll', () => {
  if (layout.mode !== 'flow' || contact.isOpen || readingFrame || !trackReading) return;
  readingFrame = requestAnimationFrame(() => {
    readingFrame = 0;
    if (layout.mode !== 'flow' || contact.isOpen || !trackReading) return;
    const distances = cards.map(card => Math.abs(card.getBoundingClientRect().top - 28));
    const index = distances.indexOf(Math.min(...distances));
    if (index !== deck.index) deck.jump(index, { focus: false });
  });
}, { passive: true });
// Seed a deep link before enabling motion. Startup font/viewport measurements
// must not cancel an animated jump and lose the requested section.
const initialIndex = cards.findIndex(card => `#${card.id}` === location.hash);
if (initialIndex >= 0) deck.jump(initialIndex, { focus: false });
layout.refresh();
if (!restartingReview && initialIndex >= 0) layout.revealCard(cards[initialIndex]);
if (initialIndex >= 0 && layout.mode === 'flow') cards[initialIndex].scrollIntoView({ block: 'start' });
if (restartingReview) window.scrollTo(0, 0);
updateControls();
debugObserver = new MutationObserver(updateDebug);
debugObserver.observe(stage, { attributes: true, attributeFilter: ['data-deck-position', 'data-deck-state', 'data-deck-rejection'] });
setupSwipeHint({ stage, cue: document.querySelector('#experimental-swipe-cue'), dialog: document.querySelector('#contact-dialog'), isBlocked: () => contact.isOpen, isReduced: () => settings.reduced });
