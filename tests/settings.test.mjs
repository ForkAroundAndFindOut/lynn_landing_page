import assert from 'node:assert/strict';
import test from 'node:test';
import { applyReviewQuery, DEFAULT_REVIEW_SETTINGS, parseReviewCookie, REVIEW_COOKIE_NAME, setupSettings, validateReviewSettings } from '../demo-settings.js';

const payload = overrides => ({ version: 1, ...DEFAULT_REVIEW_SETTINGS, ...overrides });
const encode = value => encodeURIComponent(JSON.stringify(value));

test('cookie schema accepts only supported versions, enums and boolean fields', () => {
  assert.deepEqual(parseReviewCookie(encode(payload({ preset: 'gentle', panelOpen: true }))), { ...DEFAULT_REVIEW_SETTINGS, preset: 'gentle', panelOpen: true });
  for (const value of [null, [], {}, payload({ version: 2 }), payload({ preset: 'fast' }), payload({ desktop: 'deck' }), payload({ reduce: 'false' }), payload({ debug: 1 }), payload({ panelOpen: null })]) {
    assert.equal(validateReviewSettings(value), null);
  }
  for (const value of ['', '%broken', 'undefined', encode('text')]) assert.equal(parseReviewCookie(value), null);
});

test('valid query options override saved values, while invalid values leave them intact', () => {
  const saved = { preset: 'gentle', desktop: 'conventional', reduce: true, debug: true, panelOpen: true };
  assert.deepEqual(applyReviewQuery(saved, '?preset=balanced&desktop=staggered&motion=normal&debug=0'), { preset: 'balanced', desktop: 'staggered', reduce: false, debug: false, panelOpen: true });
  assert.deepEqual(applyReviewQuery(saved, '?preset=bad&desktop=bad&motion=bad&debug=true'), saved);
  assert.deepEqual(saved, { preset: 'gentle', desktop: 'conventional', reduce: true, debug: true, panelOpen: true });
});

function browser(t, { cookie = '', blocked = false, throws = false, secure = true, search = '', osReduced = false } = {}) {
  class Control {
    value = ''; checked = false; open = false; hidden = true; textContent = ''; handlers = new Map();
    addEventListener(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, []); this.handlers.get(type).push(fn); }
    emit(type) { this.handlers.get(type)?.forEach(fn => fn()); }
  }
  const ids = ['motion-preset', 'desktop-layout', 'reduce-motion', 'show-debug', 'review-settings', 'review-persistence-status', 'reset-review-settings'];
  const controls = Object.fromEntries(ids.map(id => [id, new Control()]));
  const jar = new Map(cookie ? [[REVIEW_COOKIE_NAME, cookie]] : []);
  const writes = [];
  const doc = {
    querySelector(selector) { return controls[selector.slice(1)]; },
    get cookie() { if (throws) throw new Error('cookies disabled'); return [...jar].map(([key, value]) => `${key}=${value}`).join('; '); },
    set cookie(value) {
      if (throws) throw new Error('cookies disabled');
      writes.push(value);
      if (blocked) return;
      const pair = value.split(';')[0];
      const split = pair.indexOf('=');
      if (value.includes('Max-Age=0;')) jar.delete(pair.slice(0, split));
      else jar.set(pair.slice(0, split), pair.slice(split + 1));
    },
  };
  const url = new URL(`http${secure ? 's' : ''}://preview.example/path${search}#services`);
  const loc = { href: url.href, search: url.search, protocol: url.protocol };
  const replacements = [];
  const hist = { state: { retained: true }, replaceState(state, title, relative) { replacements.push({ state, relative }); const next = new URL(relative, loc.href); loc.href = next.href; loc.search = next.search; } };
  const media = new Control(); media.matches = osReduced;
  const globals = { document: doc, location: loc, history: hist, matchMedia: () => media, navigator: { cookieEnabled: !blocked } };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(() => { for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  let changes = 0;
  const settings = setupSettings(() => changes++);
  return { controls, jar, writes, replacements, media, settings, get changes() { return changes; } };
}

test('setup restores controls before returning, OS reduction always wins and changes persist host-only cookie', t => {
  const env = browser(t, { cookie: encode(payload({ preset: 'gentle', desktop: 'conventional', reduce: true, panelOpen: true })), search: '?preset=crisp&motion=normal&keep=yes', osReduced: true });
  assert.equal(env.settings.preset, 'crisp');
  assert.equal(env.settings.desktop, 'conventional');
  assert.equal(env.controls['reduce-motion'].checked, false);
  assert.equal(env.settings.reduced, true);
  assert.equal(env.controls['review-settings'].open, true);
  env.controls['review-settings'].emit('toggle');
  assert.equal(env.writes.length, 0);
  env.controls['show-debug'].checked = true;
  env.controls['show-debug'].emit('change');
  assert.equal(env.changes, 1);
  assert.match(env.writes[0], /; Max-Age=2592000; Path=\/; SameSite=Lax; Secure$/);
  assert.doesNotMatch(env.writes[0], /Domain=|HttpOnly/);
  assert.equal(parseReviewCookie(env.jar.get(REVIEW_COOKIE_NAME)).debug, true);
  assert.deepEqual(env.replacements[0], { state: { retained: true }, relative: '/path?keep=yes#services' });
  env.media.matches = false;
  env.media.emit('change');
  assert.equal(env.settings.reduced, false);
  assert.equal(env.changes, 2);
});

test('panel toggles persist and HTTP cookie omits Secure', t => {
  const env = browser(t, { secure: false, search: '?preset=gentle&other=1' });
  env.controls['review-settings'].open = true;
  env.controls['review-settings'].emit('toggle');
  assert.equal(parseReviewCookie(env.jar.get(REVIEW_COOKIE_NAME)).panelOpen, true);
  assert.doesNotMatch(env.writes[0], /Secure/);
  assert.equal(env.replacements[0].relative, '/path?other=1#services');
});

test('reset clears saved preferences and URL overrides, applies defaults and leaves panel open', t => {
  const env = browser(t, { cookie: encode(payload({ preset: 'gentle', desktop: 'conventional', reduce: true, debug: true })), search: '?preset=crisp&desktop=conventional&motion=reduce&debug=1&campaign=x' });
  env.controls['reset-review-settings'].emit('click');
  assert.equal(env.jar.has(REVIEW_COOKIE_NAME), false);
  assert.equal(env.settings.preset, 'balanced');
  assert.equal(env.settings.desktop, 'staggered');
  assert.equal(env.settings.reduced, false);
  assert.equal(env.settings.debug, false);
  assert.equal(env.controls['review-settings'].open, true);
  assert.equal(env.changes, 1);
  assert.equal(env.replacements[0].relative, '/path?campaign=x#services');
  env.controls['review-settings'].emit('toggle');
  assert.equal(env.writes.length, 1, 'queued reset toggle must not recreate the cleared cookie');
});

for (const failure of [{ blocked: true }, { throws: true }]) {
  test(`cookie failure (${Object.keys(failure)[0]}) keeps controls usable and reports failure`, t => {
    const env = browser(t, failure);
    assert.equal(env.settings.preset, 'balanced');
    assert.equal(env.controls['review-persistence-status'].hidden, false);
    env.controls['motion-preset'].value = 'gentle';
    assert.doesNotThrow(() => env.controls['motion-preset'].emit('change'));
    assert.equal(env.settings.preset, 'gentle');
    assert.match(env.controls['review-persistence-status'].textContent, /cannot be saved/);
    assert.doesNotThrow(() => env.controls['reset-review-settings'].emit('click'));
    assert.equal(env.settings.preset, 'balanced');
    assert.equal(env.controls['review-persistence-status'].hidden, false);
  });
}

test('malformed cookie safely defaults and shows a readable notice', t => {
  const env = browser(t, { cookie: '%broken' });
  assert.equal(env.settings.preset, 'balanced');
  assert.equal(env.controls['review-persistence-status'].hidden, false);
  assert.match(env.controls['review-persistence-status'].textContent, /could not be read/);
});
