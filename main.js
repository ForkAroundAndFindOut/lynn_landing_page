import { createDeck } from './deck-controller.js';
import { setupContact } from './contact-dialog.js';
import { setupSettings } from './demo-settings.js';
import { setupLayout } from './layout.js';

const stage = document.querySelector('#deck-stage');
const cards = [...stage.querySelectorAll('.card')];
const previous = document.querySelector('#previous-card');
const next = document.querySelector('#next-card');
const top = document.querySelector('#go-top');
const opener = document.querySelector('#open-contact');
let layout;
let contact;
let debugObserver;
let readingFrame = 0;
let trackReading = false;
const settings = setupSettings(() => { deck.settle(); layout.refresh(); updateDebug(); });

function updateControls() {
  previous.disabled = top.disabled = deck.index === 0;
  next.disabled = deck.index === cards.length - 1;
  document.querySelector('#position').innerHTML = `${String(deck.index + 1).padStart(2, '0')} <i>/</i> 06`;
  updateDebug();
}
function updateDebug() {
  const output = document.querySelector('#debug-state');
  output.hidden = !settings.debug;
  if (settings.debug) {
    output.textContent = `${layout?.mode ?? 'flow'} · ${deck.state}\nposition ${deck.position.toFixed(3)} · ${settings.preset}`;
    if (!debugObserver) { debugObserver = new MutationObserver(updateDebug); debugObserver.observe(stage, { attributes: true, attributeFilter: ['data-deck-position', 'data-deck-state'] }); }
  } else { debugObserver?.disconnect(); debugObserver = null; }
}
const deck = createDeck({
  stage, cards,
  isBlocked: () => Boolean(contact?.isOpen),
  getPreset: () => settings.preset,
  isReduced: () => settings.reduced,
  onChange(index, { focus, contact: focusContact }) {
    updateControls();
    const heading = cards[index].querySelector('h1,h2');
    document.querySelector('#card-status').textContent = `Card ${index + 1} of ${cards.length}: ${heading.textContent}`;
    if (focus) {
      trackReading = false;
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
  layout.toggleReading();
  cards[deck.index].querySelector('h1,h2').focus({ preventScroll: true });
});
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
layout.refresh();
followHash();
updateControls();
