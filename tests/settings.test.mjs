import assert from 'node:assert/strict';
import test from 'node:test';
import { applyReviewQuery, DEFAULT_REVIEW_SETTINGS, parseReviewCookie, REVIEW_COOKIE_NAME, setupSettings, validateReviewSettings } from '../demo-settings.js';
import { DEFAULT_TUNING, TUNING_FIELDS, sanitizeTuning, applyMotionPreset } from '../tuning-config.js';

const payload = overrides => ({ version: 2, ...DEFAULT_REVIEW_SETTINGS, ...overrides });
const encode = value => encodeURIComponent(JSON.stringify(value));

test('cookie schema accepts only supported versions, enums and boolean fields', () => {
  assert.deepEqual(parseReviewCookie(encode(payload({ preset: 'gentle', panelOpen: true }))), { ...DEFAULT_REVIEW_SETTINGS, preset: 'gentle', panelOpen: true });
  for (const value of [null, [], {}, payload({ version: 3 }), payload({ view: 'invalid' }), payload({ preset: 'fast' }), payload({ desktop: 'deck' }), payload({ reduce: 'false' }), payload({ debug: 1 }), payload({ panelOpen: null })]) {
    assert.equal(validateReviewSettings(value), null);
  }
  for (const value of ['', '%broken', 'undefined', encode('text')]) assert.equal(parseReviewCookie(value), null);
});

test('valid query options override saved values, while invalid values leave them intact', () => {
  const saved = { ...DEFAULT_REVIEW_SETTINGS, preset: 'gentle', desktop: 'conventional', reduce: true, debug: true, panelOpen: true };
  assert.deepEqual(applyReviewQuery(saved, '?preset=balanced&desktop=staggered&motion=normal&debug=0&view=page'), { ...DEFAULT_REVIEW_SETTINGS, preset: 'balanced', desktop: 'staggered', reduce: false, debug: false, panelOpen: true, view: 'page' });
  assert.deepEqual(applyReviewQuery(saved, '?preset=bad&desktop=bad&motion=bad&debug=true'), saved);
  assert.deepEqual(saved, { ...DEFAULT_REVIEW_SETTINGS, preset: 'gentle', desktop: 'conventional', reduce: true, debug: true, panelOpen: true });
});

function browser(t, { cookie = '', blocked = false, throws = false, secure = true, search = '', osReduced = false } = {}) {
  const controls = {};
  class Control {
    value = ''; checked = false; open = false; hidden = true; textContent = ''; handlers = new Map(); children = []; attributes = {};
    set id(value) { this._id = value; controls[value] = this; }
    get id() { return this._id; }
    append(...children) { this.children.push(...children); }
    prepend(...children) { this.children.unshift(...children); }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    addEventListener(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, []); this.handlers.get(type).push(fn); }
    emit(type) { this.handlers.get(type)?.forEach(fn => fn()); }
  }
  const ids = ['motion-preset', 'desktop-layout', 'preview-view', 'reduce-motion', 'show-debug', 'review-settings', 'review-persistence-status', 'reset-review-settings', 'reset-tuning', 'tuning-controls'];
  for (const id of ids) { const control = new Control(); control.id = id; }
  const jar = new Map(cookie ? [[REVIEW_COOKIE_NAME, cookie]] : []);
  const writes = [];
  const doc = {
    createElement(tag) { const control = new Control(); control.tagName = tag; return control; },
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
  const events = [];
  const settings = setupSettings(event => events.push(event));
  return { controls, jar, writes, replacements, media, settings, events, get changes() { return events.length; } };
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
  assert.deepEqual(env.events[0], { kind: 'debug' });
  assert.match(env.writes[0], /; Max-Age=2592000; Path=\/; SameSite=Lax; Secure$/);
  assert.doesNotMatch(env.writes[0], /Domain=|HttpOnly/);
  assert.equal(parseReviewCookie(env.jar.get(REVIEW_COOKIE_NAME)).debug, true);
  assert.deepEqual(env.replacements[0], { state: { retained: true }, relative: '/path?keep=yes#services' });
  env.media.matches = false;
  env.media.emit('change');
  assert.equal(env.settings.reduced, false);
  assert.equal(env.changes, 2);
  assert.deepEqual(env.events[1], { kind: 'motion' });
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
  assert.equal(env.settings.view, 'auto');
  assert.deepEqual(env.settings.tuning, DEFAULT_TUNING);
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
    env.controls['tuning-gate'].value = '.7';
    assert.doesNotThrow(() => env.controls['tuning-gate'].emit('change'));
    assert.equal(env.settings.tuning.gate, .7);
    assert.equal(env.controls['tuning-gate-range'].value, '0.7');
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

test('v1 cookies migrate preferences and preset shaping without importing unknown fields', () => {
  const migrated = parseReviewCookie(encode({ version: 1, preset: 'gentle', desktop: 'conventional', reduce: true, debug: true, panelOpen: true, contact: 'private', tuning: { gate: 2 } }));
  assert.deepEqual(migrated, { ...DEFAULT_REVIEW_SETTINGS, preset: 'gentle', desktop: 'conventional', reduce: true, debug: true, panelOpen: true, tuning: applyMotionPreset(DEFAULT_TUNING, 'gentle') });
  assert.equal(migrated.view, 'auto');
  assert.equal(migrated.tuning.gate, .3);
  assert.equal('contact' in migrated, false);
});

test('sanitization bounds and aligns every numeric field and defaults nonnumeric values', () => {
  assert.deepEqual(sanitizeTuning(null), DEFAULT_TUNING);
  assert.deepEqual(sanitizeTuning([]), DEFAULT_TUNING);
  for (const item of TUNING_FIELDS.filter(item => item.type !== 'boolean')) {
    assert.equal(sanitizeTuning({ [item.key]: NaN })[item.key], item.default);
    assert.equal(sanitizeTuning({ [item.key]: Infinity })[item.key], item.default);
    assert.equal(sanitizeTuning({ [item.key]: String(item.min) })[item.key], item.default);
    assert.equal(sanitizeTuning({ [item.key]: item.min - 100 })[item.key], item.min);
    assert.equal(sanitizeTuning({ [item.key]: item.max + 100 })[item.key], item.max);
    const aligned = sanitizeTuning({ [item.key]: item.min + item.step * 1.6 })[item.key];
    assert.ok(Math.abs(aligned - (item.min + 2 * item.step)) < 1e-8);
  }
  assert.equal(sanitizeTuning({ flickEnabled: 'false' }).flickEnabled, true);
  assert.equal(sanitizeTuning({ flickEnabled: false }).flickEnabled, false);
  assert.equal('contact' in sanitizeTuning({ contact: 'private' }), false);
});

test('presets change only duration and three motion shaping fields', () => {
  const seed = sanitizeTuning({ ...DEFAULT_TUNING, swipeDistance: 100, gate: .6, rotation: .5, layerOffset: 22, bounceAmplitude: 7 });
  const changed = ['duration', 'acceleration', 'deceleration', 'magneticStrength'];
  for (const [name, values] of Object.entries({ crisp: [.6, .1, .25, .15], balanced: [.9, .15, .35, .25], gentle: [1.3, .25, .45, .4] })) {
    const result = applyMotionPreset(seed, name);
    changed.forEach((key, index) => assert.equal(result[key], values[index]));
    Object.keys(seed).filter(key => !changed.includes(key)).forEach(key => assert.equal(result[key], seed[key]));
  }
  assert.deepEqual(applyMotionPreset(seed, 'unknown'), seed);
});

test('each numeric control has units and bounds, sliders update synchronously and save on release', t => {
  const env = browser(t, { search: '?preset=gentle&view=deck&campaign=x' });
  const groups = env.controls['tuning-controls'].children;
  assert.equal(groups.length, new Set(TUNING_FIELDS.map(item => item.group)).size);
  for (const item of TUNING_FIELDS.filter(item => item.type !== 'boolean')) {
    const number = env.controls[`tuning-${item.key}`];
    const range = env.controls[`tuning-${item.key}-range`];
    assert.equal(number.type, 'number');
    assert.equal(range.type, 'range');
    assert.equal(number.min, item.min);
    assert.equal(number.max, item.max);
    assert.equal(number.step, item.step);
    assert.match(number.attributes['aria-label'], new RegExp(item.unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  const slider = env.controls['tuning-gate-range'];
  slider.value = '.55'; slider.emit('input');
  assert.equal(env.settings.tuning.gate, .55);
  assert.equal(env.controls['tuning-gate'].value, '0.55');
  assert.equal(env.writes.length, 0, 'input does not write cookie for every slider position');
  assert.deepEqual(env.events.at(-1), { kind: 'tuning' });
  slider.emit('change');
  assert.equal(parseReviewCookie(env.jar.get(REVIEW_COOKIE_NAME)).tuning.gate, .55);
  assert.equal(env.writes.length, 1);
  assert.equal(env.replacements.at(-1).relative, '/path?campaign=x#services');
  const snapshot = env.settings.tuning;
  assert.equal(Object.isFrozen(snapshot), true);
  slider.value = '.6'; slider.emit('change');
  assert.equal(snapshot.gate, .55);
});

test('numeric typing stays editable, committed invalid values sanitize, and flick toggle works', t => {
  const env = browser(t);
  const number = env.controls['tuning-duration'];
  number.value = '1.'; number.emit('input');
  assert.equal(number.value, '1.');
  number.value = '1.37'; number.emit('input');
  assert.equal(env.settings.tuning.duration, 1.35);
  assert.equal(number.value, '1.37');
  number.emit('change');
  assert.equal(number.value, '1.35');
  number.value = ''; number.emit('input');
  assert.equal(number.value, '');
  number.emit('change');
  assert.equal(env.settings.tuning.duration, .9);
  const toggle = env.controls['tuning-flickEnabled'];
  toggle.checked = false; toggle.emit('change');
  assert.equal(env.settings.tuning.flickEnabled, false);
});

test('input debounce persists latest values without release', async t => {
  const env = browser(t);
  const slider = env.controls['tuning-layerOffset-range'];
  slider.value = '15'; slider.emit('input');
  slider.value = '19'; slider.emit('input');
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(env.writes.length, 1);
  assert.equal(parseReviewCookie(env.jar.get(REVIEW_COOKIE_NAME)).tuning.layerOffset, 19);
});

test('setView synchronizes selector, persists choice, clears URL conflict, and emits layout', t => {
  const env = browser(t, { search: '?view=page&keep=1' });
  assert.equal(env.settings.view, 'page');
  env.settings.setView('deck');
  assert.equal(env.settings.view, 'deck');
  assert.equal(env.controls['preview-view'].value, 'deck');
  assert.equal(parseReviewCookie(env.jar.get(REVIEW_COOKIE_NAME)).view, 'deck');
  assert.deepEqual(env.events.at(-1), { kind: 'layout' });
  assert.equal(env.replacements.at(-1).relative, '/path?keep=1#services');
  env.settings.setView('bad');
  assert.equal(env.settings.view, 'deck');
  assert.equal(env.events.length, 1);
});

test('reset tuning preserves review preferences and full reset cancels pending cookie writes', async t => {
  const env = browser(t, { cookie: encode(payload({ preset: 'gentle', view: 'deck', debug: true, tuning: { ...DEFAULT_TUNING, gate: 1 } })) });
  env.controls['reset-tuning'].emit('click');
  assert.deepEqual(env.settings.tuning, DEFAULT_TUNING);
  assert.equal(env.settings.preset, 'gentle');
  assert.equal(env.settings.view, 'deck');
  assert.equal(env.settings.debug, true);
  assert.deepEqual(env.events.at(-1), { kind: 'tuning' });
  env.controls['tuning-gate-range'].value = '.8';
  env.controls['tuning-gate-range'].emit('input');
  env.controls['reset-review-settings'].emit('click');
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(env.jar.has(REVIEW_COOKIE_NAME), false);
  assert.equal(env.settings.view, 'auto');
});

test('version 2 cookie sanitizes tuning per field and omits contact or unknown data on save', t => {
  const env = browser(t, { cookie: encode(payload({ tuning: { gate: 20, duration: 'bad', layerOffset: 15.3, flickEnabled: false, secret: 'private' }, contact: 'private' })) });
  assert.equal(env.settings.tuning.gate, 2);
  assert.equal(env.settings.tuning.duration, .9);
  assert.equal(env.settings.tuning.layerOffset, 15);
  assert.equal(env.settings.tuning.flickEnabled, false);
  env.settings.setView('deck');
  const stored = JSON.parse(decodeURIComponent(env.jar.get(REVIEW_COOKIE_NAME)));
  assert.equal(stored.version, 2);
  assert.equal('contact' in stored, false);
  assert.equal('secret' in stored.tuning, false);
});
