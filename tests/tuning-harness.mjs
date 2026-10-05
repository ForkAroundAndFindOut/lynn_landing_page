import assert from 'node:assert/strict';
import { createDeck } from '../deck-controller.js';
import { DEFAULT_TUNING } from '../tuning-config.js';

export function harness(t, configuration = {}, reduced = false) {
  const names = ['document', 'window', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'];
  const originals = Object.fromEntries(names.map(name => [name, globalThis[name]]));
  t.after(() => Object.assign(globalThis, originals));
  const documentListeners = new Map(), frames = new Map(), timers = new Map(), captures = new Set(), windowListeners = new Map();
  let sequence = 0, now = 0, blocked = false;
  const tuning = { ...DEFAULT_TUNING, ...configuration }, selection = { isCollapsed: true };
  globalThis.performance = { now: () => now };
  globalThis.document = { activeElement: null, hidden: false, addEventListener(name, fn, capture) { const list = documentListeners.get(name) || []; list.push({ fn, capture }); documentListeners.set(name, list); } };
  globalThis.window = { getSelection: () => selection, getComputedStyle: node => ({ overflowY: node.overflowY || 'visible' }), addEventListener: (name, fn) => windowListeners.set(name, fn) };
  globalThis.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  globalThis.setTimeout = (fn, delay) => { timers.set(++sequence, { fn, due: now + delay }); return sequence; };
  globalThis.clearTimeout = id => timers.delete(id);
  function element(tag = 'div', attrs = {}, parentElement = null) {
    const classes = new Set((attrs.class || '').split(' '));
    return { tagName: tag.toUpperCase(), attrs, parentElement, dataset: {}, listeners: new Map(),
      style: { setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; delete this[name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; } },
      classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
      contains(candidate) { for (let node = candidate; node; node = node.parentElement) if (node === this) return true; return false; },
      closest(selector) {
        for (let node = this; node; node = node.parentElement) if (selector.split(',').some(part => {
          const value = part.trim(), attr = value.match(/^\[([^=\]]+)(?:="([^"]+)")?\]$/);
          if (value.startsWith('.')) return (node.attrs.class || '').split(' ').includes(value.slice(1));
          if (attr) return attr[1] in node.attrs && (attr[2] === undefined || node.attrs[attr[1]] === attr[2]);
          return node.tagName.toLowerCase() === value;
        })) return node;
        return null;
      },
      addEventListener(name, fn) { const list = this.listeners.get(name) || []; list.push(fn); this.listeners.set(name, list); },
      removeEventListener(name, fn) { this.listeners.set(name, (this.listeners.get(name) || []).filter(item => item !== fn)); },
      setAttribute(name, value) { attrs[name] = value; }, removeAttribute(name) { delete attrs[name]; }, toggleAttribute(name, value) { if (value) attrs[name] = ''; else delete attrs[name]; },
    };
  }
  const stage = Object.assign(element(), { clientHeight: 640, focus() { document.activeElement = this; }, hasPointerCapture: id => captures.has(id), setPointerCapture: id => captures.add(id), releasePointerCapture: id => captures.delete(id) });
  const cards = Array.from({ length: 6 }, (_, index) => Object.assign(element('article', { class: 'card' }, stage), { id: `card-${index}`, offsetWidth: 358, offsetHeight: 570 }));
  const changes = [], requests = [];
  const deck = createDeck({ stage, cards, getTuning: () => tuning, isReduced: () => reduced, isBlocked: () => blocked, onRequest: index => requests.push(index), onChange: (index, options) => changes.push({ index, ...options }) });
  deck.setEnabled(true);
  function dispatch(name, overrides = {}) {
    const event = { target: stage, deltaX: 0, deltaY: 0, deltaMode: 0, timeStamp: now, pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: 50, clientY: 400, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...overrides };
    const list = documentListeners.get(name) || [];
    list.filter(item => item.capture).forEach(item => item.fn(event));
    if (stage.contains(event.target)) (stage.listeners.get(name) || []).forEach(fn => fn(event));
    list.filter(item => !item.capture).forEach(item => item.fn(event));
    return event;
  }
  function advance(ms) { now += ms; for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.fn(); } }
  function tick(ms = 16) { advance(ms); const list = [...frames.values()]; frames.clear(); list.forEach(fn => fn(now)); }
  function drain() { for (let n = 0; frames.size && n < 1000; n++) tick(); assert.equal(frames.size, 0); }
  function clean() { assert.equal(frames.size, 0); assert.equal(timers.size, 0); assert.equal(captures.size, 0); assert.equal(deck.state, 'idle'); assert.equal(stage.classList.contains('is-deck-dragging'), false); }
  return { deck, stage, cards, tuning, changes, requests, selection, timers, frames, captures, element, dispatch, advance, tick, drain, clean, now: () => now,
    wheel: (deltaY, overrides) => dispatch('wheel', { deltaY, ...overrides }), down: overrides => dispatch('pointerdown', overrides), move: overrides => dispatch('pointermove', overrides), up: overrides => dispatch('pointerup', overrides), block: value => { blocked = value; }, blur: () => windowListeners.get('blur')() };
}
