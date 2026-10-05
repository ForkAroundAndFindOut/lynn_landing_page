import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Chromium integration evidence only; each independent case owns its context.
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4191';
const output = path.resolve(process.env.EVIDENCE_DIR || 'verification/tuning/local');
const modulePath = process.env.PW_MODULE || 'C:/Users/pgche/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath.startsWith('file:') ? modulePath : pathToFileURL(modulePath).href);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:/Users/pgche/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe' });
const results = [], faults = [], jobs = [];
await mkdir(output, { recursive: true });
function test(name, operation) {
  if (process.env.CHECK_FILTER && !new RegExp(process.env.CHECK_FILTER).test(name)) return;
  jobs.push(async () => {
    try {
      const detail = await operation();
      results.push({ name, status: 'PASS', detail });
      console.log('PASS ' + name + ': ' + JSON.stringify(detail));
    } catch (error) {
      results.push({ name, status: 'FAIL', message: error.message, stack: error.stack });
      console.error('FAIL ' + name + ': ' + error.message);
    }
  });
}
async function isolated(options, operation, suffix = '') {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => faults.push({ type: 'pageerror', message: error.message }));
  page.on('console', msg => { if (msg.type() === 'error') faults.push({ type: 'console', message: msg.text() }); });
  page.on('requestfailed', request => faults.push({ type: 'requestfailed', url: request.url(), message: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) faults.push({ type: 'http', url: response.url(), status: response.status() }); });
  await page.addInitScript(() => {
    window.__tuningInput = [];
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown', 'click']) document.addEventListener(type, e => {
      window.__tuningInput.push({ type, trusted: e.isTrusted, pointerType: e.pointerType, time: performance.now(), x: e.clientX, y: e.clientY, key: e.key });
    }, { capture: true, passive: true });
    window.__tuningFrames = [];
    function sample() {
      const stage = document.querySelector('#deck-stage');
      if (stage) window.__tuningFrames.push({ time: performance.now(), state: stage.dataset.deckState, position: Number(stage.dataset.deckPosition), target: Number(document.querySelector('#position')?.textContent.trim().slice(0, 2)) - 1 });
      if (window.__tuningFrames.length > 6000) window.__tuningFrames.shift();
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  try {
    await page.goto(baseURL + suffix);
    await page.locator('#review-settings:not([hidden])').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    return await operation(page, context);
  } finally { await context.close(); }
}
const state = page => page.evaluate(() => ({ mode: document.body.dataset.mode, state: document.querySelector('#deck-stage').dataset.deckState, position: Number(document.querySelector('#deck-stage').dataset.deckPosition), target: Number(document.querySelector('#position').textContent.trim().slice(0, 2)) - 1, rejection: document.querySelector('#deck-stage').dataset.deckRejection, reduced: document.body.dataset.reduced }));
async function settled(page, target, timeout = 8000) {
  await page.waitForFunction(target => { const el = document.querySelector('#deck-stage'); return el.dataset.deckState === 'idle' && Math.abs(Number(el.dataset.deckPosition) - target) < .001; }, target, { timeout });
}
async function requested(page, target) {
  await page.waitForFunction(target => Number(document.querySelector('#position').textContent.trim().slice(0, 2)) - 1 === target, target);
}
async function panel(page, open = true) {
  if (await page.locator('#review-settings').evaluate(el => el.open) !== open) await page.locator('#review-settings summary').click();
}
async function number(page, key, value) {
  const locator = page.locator('#tuning-' + key);
  await locator.fill(String(value));
  await locator.press('Tab');
}
async function tuning(page) {
  return page.evaluate(async () => { const { TUNING_FIELDS } = await import('./tuning-config.js'); return Object.fromEntries(TUNING_FIELDS.map(f => [f.key, f.type === 'boolean' ? document.querySelector('#tuning-' + f.key).checked : Number(document.querySelector('#tuning-' + f.key).value)])); });
}
async function metadata(page) {
  return page.evaluate(async () => { const { TUNING_FIELDS, DEFAULT_TUNING } = await import('./tuning-config.js'); return { fields: TUNING_FIELDS, defaults: DEFAULT_TUNING }; });
}
async function textPoint(page) {
  return page.locator('.card[data-active] h1,.card[data-active] h2').evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el);
    const rect = range.getClientRects()[0];
    const point = { x: rect.left + Math.min(24, rect.width / 2), y: rect.top + rect.height / 2 };
    if (!el.contains(document.elementFromPoint(point.x, point.y))) throw new Error('Text gesture point is obscured');
    return point;
  });
}
async function stagePoint(page) {
  return page.locator('#deck-stage').evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * .65 }; });
}
async function touch(session, type, points = []) {
  await session.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ id: 1, ...p })) });
}
async function swipe(page, session, start, distance, milliseconds = 80, steps = 4) {
  await touch(session, 'touchStart', [start]);
  for (let step = 1; step <= steps; step++) {
    await page.waitForTimeout(milliseconds / steps);
    await touch(session, 'touchMove', [{ x: start.x, y: start.y - distance * step / steps }]);
  }
  await touch(session, 'touchEnd');
}
async function trusted(page, type, pointerType) {
  const events = await page.evaluate(() => window.__tuningInput);
  assert.ok(events.some(e => e.type === type && e.trusted && (!pointerType || e.pointerType === pointerType)), 'Expected browser-trusted ' + type);
}
async function transition(page, target, action) {
  const start = await page.evaluate(() => performance.now());
  await action(); await requested(page, target); await settled(page, target); await page.waitForTimeout(40);
  const samples = await page.evaluate(start => window.__tuningFrames.filter(f => f.time >= start), start);
  const first = samples.find(f => f.target === target && f.state === 'settling');
  const end = samples.find(f => first && f.time >= first.time && f.target === target && f.state === 'idle' && Math.abs(f.position - target) < .001);
  assert.ok(first && end, 'Animation must expose a settling interval before the idle target');
  return { milliseconds: end.time - first.time, frames: samples.length, startPosition: first.position };
}
function durationWithin(value, expected) {
  assert.ok(value >= expected - 70 && value <= expected + 180, `Observed ${value.toFixed(1)}ms; expected ${expected.toFixed(1)}ms with browser frame tolerance`);
}
async function noOverflow(page) {
  const widths = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(widths.scroll <= widths.client + 1, 'Horizontal overflow ' + JSON.stringify(widths));
}

// Hit real rendered children and record the browser's final click disposition.
// No synthetic DOM input is used to demonstrate gesture or activation behavior.
async function controlPoint(page, selector) {
  return page.locator(selector).evaluate(el => {
    const rect = el.getBoundingClientRect(), point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const hit = document.elementFromPoint(point.x, point.y);
    if (!el.contains(hit)) throw new Error('Gesture control is obscured: ' + el.outerHTML);
    return point;
  });
}
async function observeControlClicks(page) {
  await page.evaluate(() => {
    window.__controlClicks = []; window.__controlDrags = [];
    document.addEventListener('click', event => {
      const target = event.target, activation = target.closest('a,button');
      const record = { trusted: event.isTrusted, detail: event.detail, pointerType: event.pointerType, target: target.id || target.tagName, activation: activation?.id || activation?.getAttribute('href') || null, prevented: false };
      window.__controlClicks.push(record);
      setTimeout(() => { record.prevented = event.defaultPrevented; }, 0);
    }, true);
    document.addEventListener('dragstart', event => {
      const record = { trusted: event.isTrusted, prevented: false }; window.__controlDrags.push(record);
      setTimeout(() => { record.prevented = event.defaultPrevented; }, 0);
    }, true);
  });
}
async function controlClicks(page) { await page.waitForTimeout(30); return page.evaluate(() => window.__controlClicks); }
async function mouseReturnSwipe(page, start, distance) {
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x, start.y - distance, { steps: 4 });
  await page.mouse.move(start.x, start.y, { steps: 4 }); await page.mouse.up();
}

test('link swipe: trusted touch on nested arrow waits for full distance and reverse card-child swipe returns', () => isolated({}, async (page, context) => {
  const session = await context.newCDPSession(page), start = await controlPoint(page, '#top .text-link span');
  await observeControlClicks(page); await touch(session, 'touchStart', [start]);
  await touch(session, 'touchMove', [{ x: start.x, y: start.y - 47 }]);
  assert.equal((await state(page)).target, 0, 'A link start cannot take the configured 16px flick shortcut');
  await touch(session, 'touchMove', [{ x: start.x, y: start.y - 48 }]); await requested(page, 1);
  await touch(session, 'touchEnd'); await settled(page, 1);
  const reverse = await controlPoint(page, '#services .card-foot .small-mark');
  await swipe(page, session, reverse, -64); await requested(page, 0); await settled(page, 0);
  const near = await page.locator('#top .text-link').evaluate(el => {
    const rect = el.getBoundingClientRect(), point = { x: rect.left + rect.width / 2, y: rect.top - 6 };
    if (!el.closest('.card').contains(document.elementFromPoint(point.x, point.y))) throw new Error('Near-link point is outside the active card');
    return point;
  });
  await swipe(page, session, near, 64); await requested(page, 1); await settled(page, 1);
  await swipe(page, session, await controlPoint(page, '#services .card-foot .small-mark'), -64); await settled(page, 0);
  await trusted(page, 'pointerdown', 'touch'); await trusted(page, 'pointermove', 'touch');
  return { linkChildThreshold: 48, belowThreshold: 47, nearLinkAccepted: true, reverseActualCardChild: '#services .small-mark', finalTarget: 0, clicks: await controlClicks(page) };
}));

test('link swipe: trusted reverse from link and contact-button child advances exactly one card', () => isolated({}, async (page, context) => {
  const session = await context.newCDPSession(page); await observeControlClicks(page);
  await settled(page, 4); await swipe(page, session, await controlPoint(page, '#working-together .text-link span'), -64);
  await requested(page, 3); await settled(page, 3);
  await page.locator('.header-contact').click(); await settled(page, 5);
  await swipe(page, session, await controlPoint(page, '#open-contact span'), -64); await requested(page, 4); await settled(page, 4);
  assert.equal(await page.locator('#contact-dialog').evaluate(el => el.open), false, 'Button swipe must not open the form');
  await trusted(page, 'pointerdown', 'touch');
  return { linkReverse: [4, 3], buttonReverse: [5, 4], dialogOpen: false, clicks: await controlClicks(page) };
}, '#working-together'));

test('link swipe: stationary trusted taps activate the intended section and contact form once', () => isolated({}, async (page, context) => {
  const session = await context.newCDPSession(page); await observeControlClicks(page);
  const link = await controlPoint(page, '#top .text-link span'); await touch(session, 'touchStart', [link]); await touch(session, 'touchEnd');
  await settled(page, 1); assert.equal(await page.evaluate(() => document.activeElement.id), 'services-title');
  let clicks = await controlClicks(page); assert.equal(clicks.filter(e => e.activation === '#services' && e.trusted && !e.prevented).length, 0, 'Section handler owns the native link default');
  assert.equal(clicks.filter(e => e.activation === '#services' && e.trusted).length, 1);
  await page.locator('.header-contact').click(); await settled(page, 5);
  const button = await controlPoint(page, '#open-contact span'); await touch(session, 'touchStart', [button]); await touch(session, 'touchEnd');
  await page.waitForFunction(() => document.querySelector('#contact-dialog').open);
  clicks = await controlClicks(page); assert.equal(clicks.filter(e => e.activation === 'open-contact' && e.trusted && !e.prevented).length, 1);
  assert.equal((await state(page)).target, 5);
  return { linkActivations: 1, focusedSection: 'services-title', contactActivations: 1, clicks };
}));

test('link swipe: 20px acquired gestures do not shuffle or activate; 5px mouse jitter retains native activation', () => isolated({}, async (page, context) => {
  const session = await context.newCDPSession(page); await observeControlClicks(page);
  const start = await controlPoint(page, '#top .text-link');
  await swipe(page, session, start, 20, 10, 1);
  assert.equal((await state(page)).target, 0, 'Rapid link motion below 48px must not shuffle');
  await touch(session, 'touchStart', [start]); await page.waitForTimeout(420);
  await touch(session, 'touchMove', [{ x: start.x, y: start.y - 64 }]); await touch(session, 'touchEnd');
  assert.equal((await state(page)).target, 0, 'A held link remains native beyond the configured 350ms hold window');
  await page.evaluate(() => { const range = document.createRange(); range.selectNodeContents(document.querySelector('#hero-title')); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); });
  await swipe(page, session, start, 64);
  assert.equal((await state(page)).target, 0, 'An existing text selection excludes a link swipe');
  await page.evaluate(() => getSelection().removeAllRanges());
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x, start.y - 20);
  assert.equal((await state(page)).target, 0, 'Mouse link motion below 48px must not shuffle before release');
  await page.mouse.move(start.x, start.y); await page.mouse.up();
  let clicks = await controlClicks(page);
  assert.equal((await state(page)).target, 0, '20px acquires a gesture at 6px but cannot issue a card command below 48px');
  assert.ok(clicks.some(e => e.trusted && e.pointerType === 'mouse' && e.prevented), 'An acquired return gesture consumes its pointer click');
  assert.equal(clicks.filter(e => e.activation === '#services').length, 0, 'Aborted acquired gesture must not activate the link');
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x, start.y - 5); await page.mouse.move(start.x, start.y); await page.mouse.up();
  await settled(page, 1); clicks = await controlClicks(page);
  assert.equal(clicks.filter(e => e.trusted && e.activation === '#services').length, 1, 'A fresh 5px mouse jitter stays below acquisition and retains native activation');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'services-title');
  const drags = await page.evaluate(() => window.__controlDrags); assert.ok(drags.every(e => e.prevented), 'Native anchor dragging is prevented while a swipe candidate exists');
  return { rapidTouchDistance: 20, mouseDistance: 20, acquisitionDistance: 6, commandDistance: 48, nativeJitterDistance: 5, heldMilliseconds: 420, selectionPreservedTarget: 0, targetAfterAcquiredRelease: 0, targetAfterNativeJitterActivation: 1, clicks, nativeDrags: drags };
}));

test('link swipe: mouse threshold consumes its returned pointer click and leaves immediate unrelated activation usable', () => isolated({ hasTouch: false }, async page => {
  await observeControlClicks(page); await mouseReturnSwipe(page, await controlPoint(page, '#top .text-link span'), 64);
  await requested(page, 1);
  let clicks = await controlClicks(page); assert.ok(clicks.some(e => e.trusted && e.pointerType === 'mouse' && e.prevented), 'A real pointer click following the consumed swipe must be prevented');
  assert.notEqual(await page.evaluate(() => document.activeElement.id), 'services-title', 'Swipe must not execute the link section-focus activation');
  await page.locator('.header-contact').click(); await settled(page, 5);
  clicks = await controlClicks(page); assert.equal(clicks.filter(e => e.activation === '#contact' && e.trusted).length, 1, 'Unrelated subsequent trusted click remains usable');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'open-contact');
  const drags = await page.evaluate(() => window.__controlDrags); assert.ok(drags.every(e => e.prevented));
  return { swipeTarget: 1, unrelatedClickTarget: 5, clicks, nativeDrags: drags };
}));

test('link swipe: gate and endpoint rejected button swipes consume click but preserve keyboard and later pointer activation', async () => {
  const endpoint = await isolated({}, async (page, context) => {
    await settled(page, 5); await observeControlClicks(page);
    const session = await context.newCDPSession(page);
    await swipe(page, session, await controlPoint(page, '#open-contact span'), 64);
    assert.equal((await state(page)).target, 5); assert.equal(await page.locator('#contact-dialog').evaluate(el => el.open), false, 'Trusted touch endpoint swipe must not open the form');
    await mouseReturnSwipe(page, await controlPoint(page, '#open-contact span'), 64);
    assert.equal((await state(page)).target, 5); assert.equal(await page.locator('#contact-dialog').evaluate(el => el.open), false);
    const clicks = await controlClicks(page); assert.ok(clicks.some(e => e.trusted && e.pointerType === 'mouse' && e.prevented), 'Endpoint rejection still consumes the following pointer click');
    await page.locator('#open-contact').focus(); await page.keyboard.press('Enter'); await page.waitForFunction(() => document.querySelector('#contact-dialog').open);
    const activated = await controlClicks(page); assert.ok(activated.some(e => e.activation === 'open-contact' && e.trusted && e.detail === 0 && !e.prevented), 'Keyboard activation remains available after a consumed swipe');
    await trusted(page, 'pointerdown', 'touch');
    return { target: 5, touchEndpointDialogOpen: false, keyboardActivated: true, clicks: activated };
  }, '#contact');
  const gate = await isolated({ hasTouch: false }, async page => {
    await settled(page, 4); await panel(page); await number(page, 'duration', .2); await number(page, 'gate', 2); await panel(page, false);
    await page.locator('#next-card').click(); await settled(page, 5); await observeControlClicks(page);
    await mouseReturnSwipe(page, await controlPoint(page, '#open-contact'), -64);
    assert.equal((await state(page)).target, 5); assert.equal((await state(page)).rejection, 'gate'); assert.equal(await page.locator('#contact-dialog').evaluate(el => el.open), false);
    const clicks = await controlClicks(page); assert.ok(clicks.some(e => e.trusted && e.pointerType === 'mouse' && e.prevented), 'Gate rejection consumes the following pointer click');
    await page.locator('#open-contact').click(); await page.waitForFunction(() => document.querySelector('#contact-dialog').open);
    return { rejectedTarget: 5, rejection: 'gate', freshPointerActivated: true, clicks: await controlClicks(page) };
  }, '#working-together');
  return { endpoint, gate };
});

test('all 25 tuning controls expose metadata, synchronize numeric/range pairs and save edits', () => isolated({}, async (page, context) => {
  await panel(page); const { fields, defaults } = await metadata(page);
  assert.equal(fields.length, 25); assert.deepEqual(await tuning(page), defaults);
  const edits = {};
  for (const f of fields) {
    const control = page.locator('#tuning-' + f.key);
    if (f.type === 'boolean') { await control.uncheck(); edits[f.key] = false; continue; }
    const range = page.locator('#tuning-' + f.key + '-range');
    for (const c of [control, range]) {
      assert.equal(Number(await c.getAttribute('min')), f.min);
      assert.equal(Number(await c.getAttribute('max')), f.max);
      assert.equal(Number(await c.getAttribute('step')), f.step);
      assert.ok(await c.getAttribute('aria-label'));
    }
    const value = Number((f.min + f.step).toFixed(6));
    await number(page, f.key, value);
    assert.equal(Number(await range.inputValue()), value, f.key + ' numeric edit updates range');
    await range.focus(); await range.press('End'); await range.press('ArrowLeft');
    const changed = Number(await range.inputValue());
    assert.equal(Number(await control.inputValue()), changed, f.key + ' trusted range edit updates number');
    assert.ok(changed >= f.min && changed <= f.max); edits[f.key] = changed;
  }
  await page.waitForTimeout(250);
  const cookie = (await context.cookies()).find(c => c.name === 'lynn_review_settings'); assert.ok(cookie);
  const saved = JSON.parse(decodeURIComponent(cookie.value)); assert.equal(saved.version, 2); assert.deepEqual(saved.tuning, edits);
  assert.ok(Math.abs(cookie.expires - Date.now() / 1000 - 30 * 86400) < 10, 'Cookie expires in 30 days');
  assert.equal(cookie.sameSite, 'Lax'); assert.equal(cookie.path, '/');
  await trusted(page, 'keydown'); await noOverflow(page);
  return { fields: fields.length, numericPairs: fields.filter(f => f.type !== 'boolean').length, version: saved.version, expiresDays: 30 };
}));

test('numeric controls clamp committed out-of-range values and recover an empty edit', () => isolated({}, async page => {
  await panel(page); await number(page, 'duration', 99); assert.equal((await tuning(page)).duration, 3);
  await number(page, 'gate', -99); assert.equal((await tuning(page)).gate, 0);
  await page.locator('#tuning-swipeDistance').fill(''); await page.locator('#tuning-swipeDistance').press('Tab');
  assert.equal((await tuning(page)).swipeDistance, 48);
  return { maximumDuration: 3, minimumGate: 0, emptySwipeDistance: 48 };
}));

test('motion presets change only duration, acceleration, deceleration and magnetic strength', () => isolated({}, async page => {
  await panel(page); await number(page, 'swipeDistance', 72); await number(page, 'rotation', 1.25); await number(page, 'gate', .45);
  const baseline = await tuning(page), allowed = new Set(['duration', 'acceleration', 'deceleration', 'magneticStrength']);
  const measured = [];
  for (const [preset, seconds] of [['crisp', .6], ['balanced', .9], ['gentle', 1.3]]) {
    await page.locator('#motion-preset').selectOption(preset); const value = await tuning(page);
    assert.equal(value.duration, seconds);
    for (const key of Object.keys(value)) if (!allowed.has(key)) assert.equal(value[key], baseline[key], key + ' preserved by ' + preset);
    measured.push({ preset, duration: value.duration, acceleration: value.acceleration, deceleration: value.deceleration, magneticStrength: value.magneticStrength });
  }
  return measured;
}));

for (const [preset, duration] of [['crisp', 600], ['balanced', 900], ['gentle', 1300]]) test('trusted adjacent controls honor ' + preset + ' transition duration', () => isolated({ hasTouch: false }, async page => {
  assert.equal((await state(page)).mode, 'deck');
  const measured = await transition(page, 1, () => page.locator('#next-card').click()); durationWithin(measured.milliseconds, duration);
  await trusted(page, 'click'); return { preset, ...measured };
}, '?preset=' + preset));

test('text-start touch swipes are commands: no finger tracking, one card per contact, speed-independent timing', () => isolated({}, async (page, context) => {
  const session = await context.newCDPSession(page); await panel(page); await page.locator('#tuning-flickEnabled').uncheck(); await panel(page, false);
  const start = await textPoint(page); await touch(session, 'touchStart', [start]);
  await touch(session, 'touchMove', [{ x: start.x, y: start.y - 12 }]); await page.waitForTimeout(80);
  assert.equal((await state(page)).position, 0, 'Below-threshold touch must not pin or track card progress');
  const timestamp = await page.evaluate(() => performance.now());
  await touch(session, 'touchMove', [{ x: start.x, y: start.y - 60 }]); await requested(page, 1);
  await page.waitForTimeout(360); await touch(session, 'touchMove', [{ x: start.x, y: start.y - 180 }]);
  assert.equal((await state(page)).target, 1, 'Same contact never requests another card after gate expires');
  await touch(session, 'touchEnd'); await settled(page, 1); await page.waitForTimeout(40);
  const frames = await page.evaluate(t => window.__tuningFrames.filter(f => f.time >= t), timestamp);
  const first = frames.find(f => f.state === 'settling'); const last = frames.find(f => f.state === 'idle' && f.position === 1);
  durationWithin(last.time - first.time, 900);
  const slow = await transition(page, 2, async () => swipe(page, session, await textPoint(page), 64, 240, 8));
  durationWithin(slow.milliseconds, 900); await trusted(page, 'pointerdown', 'touch'); await trusted(page, 'pointermove', 'touch');
  return { threshold: 48, subThresholdPose: 0, heldContactTarget: 1, fastMilliseconds: last.time - first.time, slowMilliseconds: slow.milliseconds };
}));

test('flick shortcut recognizes recent velocity and can be disabled; held text remains native', () => isolated({}, async (page, context) => {
  const session = await context.newCDPSession(page);
  await swipe(page, session, await textPoint(page), 22, 180, 6); assert.equal((await state(page)).target, 0, 'Slow sub-threshold motion is not a flick');
  await swipe(page, session, await textPoint(page), 24, 10, 1); await requested(page, 1); await settled(page, 1);
  await panel(page); await page.locator('#tuning-flickEnabled').uncheck(); await panel(page, false);
  await swipe(page, session, await textPoint(page), 24, 10, 1); assert.equal((await state(page)).target, 1, 'Disabled flick requires full distance');
  const start = await textPoint(page); await touch(session, 'touchStart', [start]); await page.waitForTimeout(420);
  await touch(session, 'touchMove', [{ x: start.x, y: start.y - 90 }]); await touch(session, 'touchEnd');
  assert.equal((await state(page)).target, 1, 'Post-hold text movement stays native');
  return { slowFlickRejected: true, fastFlickAccepted: true, disabledFlickRejected: true, holdDelayMilliseconds: 350 };
}));

test('gate rejects adjacent buttons and keyboard requests, then retargets continuously toward last requested card', () => isolated({ hasTouch: false }, async page => {
  await panel(page); await number(page, 'duration', 1.3); await number(page, 'gate', .3); await panel(page, false);
  await page.locator('#next-card').click(); await requested(page, 1); assert.match(await page.locator('#gate-status').textContent(), /next request in/i); await page.locator('#next-card').click();
  await page.locator('#deck-stage').focus(); await page.keyboard.press('ArrowDown');
  assert.equal((await state(page)).target, 1); assert.equal((await state(page)).rejection, 'gate');
  await page.waitForTimeout(330);
  const before = await state(page); assert.ok(before.position > 0 && before.position < 1);
  await page.keyboard.press('ArrowDown'); await requested(page, 2);
  const after = await state(page); assert.equal(after.state, 'settling'); assert.ok(after.position < 1, 'Retarget does not settle to prior requested card');
  await page.waitForTimeout(330); await page.keyboard.press('ArrowUp'); await requested(page, 1);
  assert.equal((await state(page)).state, 'settling'); await settled(page, 1);
  await trusted(page, 'keydown'); return { rejectedTarget: 1, firstRetarget: 2, lastRequestedTarget: 1, before, after };
}));

test('a touch rejected by gate remains consumed for its entire contact', () => isolated({}, async (page, context) => {
  const session = await context.newCDPSession(page); const start = await textPoint(page);
  await page.locator('#next-card').click(); await requested(page, 1);
  await touch(session, 'touchStart', [start]); await touch(session, 'touchMove', [{ x: start.x, y: start.y - 70 }]);
  assert.equal((await state(page)).target, 1); assert.equal((await state(page)).rejection, 'gate');
  await page.waitForTimeout(350); await touch(session, 'touchMove', [{ x: start.x, y: start.y - 150 }]);
  assert.equal((await state(page)).target, 1); await touch(session, 'touchEnd'); await settled(page, 1);
  await swipe(page, session, await textPoint(page), 70); await requested(page, 2); await settled(page, 2);
  return { rejectedContactTarget: 1, freshContactTarget: 2 };
}));

test('wheel uses one attempt per burst including gate rejection and honors the 400ms quiet boundary', () => isolated({ hasTouch: false }, async page => {
  const point = await stagePoint(page); await page.mouse.move(point.x, point.y);
  await page.locator('#next-card').click(); await requested(page, 1); await page.mouse.move(point.x, point.y); await page.mouse.wheel(0, 80); await page.waitForTimeout(50);
  assert.equal((await state(page)).target, 1); assert.equal((await state(page)).rejection, 'gate');
  await page.waitForTimeout(310); await page.mouse.wheel(0, 800); await page.waitForTimeout(30);
  assert.equal((await state(page)).target, 1, 'Rejected burst is not revived when request gate expires');
  await page.waitForTimeout(450); await page.mouse.wheel(0, 80); await requested(page, 2); await settled(page, 2);
  await trusted(page, 'wheel'); return { quietMilliseconds: 400, rejectedBurstTarget: 1, freshBurstTarget: 2 };
}));

test('wheel delta magnitude cannot alter duration or advance more than one card', () => isolated({ hasTouch: false }, async page => {
  const point = await stagePoint(page); await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, 4); await page.waitForTimeout(30); assert.equal((await state(page)).target, 0); assert.equal((await state(page)).position, 0);
  await page.waitForTimeout(450);
  const ordinary = await transition(page, 1, () => page.mouse.wheel(0, 20)); durationWithin(ordinary.milliseconds, 900);
  const large = await transition(page, 2, () => page.mouse.wheel(0, 2000)); durationWithin(large.milliseconds, 900);
  assert.equal((await state(page)).target, 2); await trusted(page, 'wheel');
  return { tinyDelta: 4, ordinaryDelta: 20, largeDelta: 2000, ordinaryMilliseconds: ordinary.milliseconds, largeMilliseconds: large.milliseconds };
}));

test('zero gate accumulates rapid adjacent requests and duration scales with remaining card distance', () => isolated({ hasTouch: false }, async page => {
  await panel(page); await number(page, 'gate', 0); await panel(page, false); await page.locator('#deck-stage').focus();
  await page.keyboard.press('ArrowDown'); await requested(page, 1); await page.keyboard.press('ArrowDown'); await requested(page, 2);
  const from = await state(page); assert.ok(from.position < .2, 'Rapid second request preserves in-flight pose');
  const final = await transition(page, 3, () => page.keyboard.press('ArrowDown'));
  durationWithin(final.milliseconds, 900 * (3 - final.startPosition));
  assert.equal((await state(page)).target, 3); assert.equal((await state(page)).position, 3);
  return { from: from.position, lastRequestedTarget: 3, measuredMilliseconds: final.milliseconds, expectedMilliseconds: 900 * (3 - final.startPosition) };
}));
test('live tuning edits preserve active animation and gate changes apply immediately', () => isolated({}, async page => {
  await panel(page); await number(page, 'duration', 1.3); await number(page, 'gate', 2);
  await page.locator('#tuning-next').click(); await requested(page, 1); await page.waitForTimeout(120);
  const before = await state(page); await number(page, 'duration', .6); const after = await state(page);
  assert.equal(after.state, 'settling'); assert.equal(after.target, 1); assert.ok(after.position > 0 && after.position < 1, 'Duration edit must not settle or cancel active timeline');
  await page.locator('#tuning-next').click(); assert.equal((await state(page)).target, 1);
  await number(page, 'gate', 0); assert.match(await page.locator('#gate-status').textContent(), /ready/i);
  const from = await state(page); const measured = await transition(page, 2, () => page.locator('#tuning-next').click());
  durationWithin(measured.milliseconds, 600 * (2 - measured.startPosition));
  await page.locator('#tuning-top').click(); await settled(page, 0);
  await page.locator('#tuning-next').click(); await settled(page, 1); await page.locator('#tuning-previous').click(); await settled(page, 0);
  return { before, after, retargetFrom: from.position, retargetMilliseconds: measured.milliseconds, playButtons: ['previous', 'next', 'top'] };
}));

test('v2 cookie restores review preferences and tuning, reload starts at top, reset scopes remain distinct', () => isolated({}, async (page, context) => {
  await panel(page); await page.locator('#motion-preset').selectOption('gentle'); await page.locator('#desktop-layout').selectOption('conventional'); await page.locator('#show-debug').check();
  await number(page, 'swipeDistance', 72); await page.locator('#preview-view').selectOption('deck');
  await page.locator('#tuning-next').click(); await settled(page, 1);
  const savedCookie = (await context.cookies()).find(c => c.name === 'lynn_review_settings'); const saved = JSON.parse(decodeURIComponent(savedCookie.value));
  assert.equal(saved.version, 2); assert.equal(saved.panelOpen, true);
  assert.ok(!Object.hasOwn(saved, 'position') && !Object.hasOwn(saved, 'card') && !Object.hasOwn(saved, 'draft'));
  await page.reload(); await settled(page, 0);
  assert.equal((await tuning(page)).swipeDistance, 72); assert.equal(await page.locator('#preview-view').inputValue(), 'deck'); assert.equal(await page.locator('#motion-preset').inputValue(), 'gentle');
  assert.equal(await page.locator('#review-settings').evaluate(el => el.open), true); assert.equal(await page.locator('#show-debug').isChecked(), true);
  await page.locator('#reset-tuning').click(); assert.deepEqual(await tuning(page), (await metadata(page)).defaults);
  assert.equal(await page.locator('#motion-preset').inputValue(), 'gentle'); assert.equal(await page.locator('#preview-view').inputValue(), 'deck'); assert.equal(await page.locator('#desktop-layout').inputValue(), 'conventional'); assert.equal(await page.locator('#show-debug').isChecked(), true);
  await page.locator('#reset-review-settings').click(); assert.equal(await page.locator('#preview-view').inputValue(), 'auto'); assert.equal(await page.locator('#motion-preset').inputValue(), 'balanced'); assert.equal(await page.locator('#desktop-layout').inputValue(), 'staggered'); assert.equal(await page.locator('#show-debug').isChecked(), false);
  assert.equal((await context.cookies()).some(c => c.name === 'lynn_review_settings'), false);
  await page.reload(); await settled(page, 0); assert.equal(await page.locator('#review-settings').evaluate(el => el.open), false);
  return { cookieVersion: 2, startsAtTop: true, resetTuningPreservesReview: true, resetAllDeletesCookie: true };
}));

for (const [width, height] of [[390, 844], [1280, 900]]) test('preview modes and independently scrolling panel fit ' + width + 'x' + height, () => isolated({ viewport: { width, height }, hasTouch: width < 900 }, async page => {
  assert.equal((await state(page)).mode, width < 900 ? 'deck' : 'flow'); await panel(page);
  await page.locator('#preview-view').selectOption('deck'); await page.waitForTimeout(100); assert.equal((await state(page)).mode, 'deck');
  const geometry = await page.evaluate(() => {
    const stage = document.querySelector('#deck-stage').getBoundingClientRect(); const panel = document.querySelector('#review-settings').getBoundingClientRect(); const body = document.querySelector('.settings-body');
    return { stage: stage.toJSON(), panel: panel.toJSON(), scrollHeight: body.scrollHeight, clientHeight: body.clientHeight, overflowY: getComputedStyle(body).overflowY, touchAction: getComputedStyle(body).touchAction };
  });
  assert.ok(geometry.panel.top >= 0 && geometry.panel.bottom <= height + 1); assert.ok(geometry.scrollHeight > geometry.clientHeight); assert.equal(geometry.overflowY, 'auto'); assert.equal(geometry.touchAction, 'pan-y');
  if (width >= 900) { assert.ok(Math.abs(geometry.stage.width - (width - 360)) <= 1); assert.ok(geometry.stage.right <= geometry.panel.left, 'Wide deck reserves independent sidebar'); }
  else assert.ok(geometry.panel.height <= height * .45 + 1);
  await page.locator('.settings-body').evaluate(el => el.scrollTop = 0); const panelPoint = await page.locator('#motion-preset').boundingBox();
  await page.mouse.move(panelPoint.x + 5, panelPoint.y + 5); await page.mouse.wheel(0, 500); await page.waitForTimeout(100);
  assert.ok(await page.locator('.settings-body').evaluate(el => el.scrollTop) > 0); assert.equal((await state(page)).target, 0);
  await noOverflow(page); await page.screenshot({ path: path.join(output, 'tuning-panel-' + width + '.png') });
  await page.locator('#preview-view').selectOption('page'); assert.equal((await state(page)).mode, 'flow'); await panel(page, false);
  await page.mouse.move(20, 300); await page.mouse.wheel(0, 700); await page.waitForTimeout(150); assert.ok(await page.evaluate(() => window.scrollY) > 0, 'Reading view preserves native page scrolling');
  await panel(page); await page.locator('#preview-view').selectOption('auto'); assert.equal((await state(page)).mode, width < 900 ? 'deck' : 'flow');
  return { width, height, geometry, nativePageScroll: true };
}));

test('OS reduced motion overrides explicit deck and manual normal motion preference', () => isolated({ viewport: { width: 1280, height: 900 }, hasTouch: false, reducedMotion: 'reduce' }, async page => {
  await panel(page); await page.locator('#preview-view').selectOption('deck'); await page.locator('#reduce-motion').uncheck();
  assert.equal((await state(page)).mode, 'flow'); assert.equal((await state(page)).reduced, 'true');
  assert.equal(await page.locator('.card').evaluateAll(cards => cards.every(card => !card.inert && card.getAttribute('aria-hidden') !== 'true')), true);
  assert.equal(await page.locator('.card').evaluateAll(cards => cards.flatMap(card => card.getAnimations()).filter(a => a.playState === 'running').length), 0);
  await panel(page, false); await page.mouse.move(20, 300); await page.mouse.wheel(0, 650); await page.waitForTimeout(100); assert.ok(await page.evaluate(() => scrollY) > 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForTimeout(100); assert.equal((await state(page)).mode, 'deck');
  return { OSPrecedence: true, explicitDeckRestoredAfterOSChange: true, nativeScroll: true };
}));

test('compact height and JavaScript-disabled pages preserve readable native document flow', async () => {
  const short = await isolated({ viewport: { width: 1280, height: 500 }, hasTouch: false }, async page => {
    await panel(page); await page.locator('#preview-view').selectOption('deck'); assert.equal((await state(page)).mode, 'flow'); await panel(page, false); await noOverflow(page);
    assert.equal(await page.locator('.card').evaluateAll(cards => cards.every(card => !card.inert)), true); return { explicitDeckFallback: 'flow' };
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false }); const page = await context.newPage();
  try { await page.goto(baseURL); assert.equal(await page.locator('body').getAttribute('data-mode'), 'flow'); assert.equal(await page.locator('.card').count(), 6); assert.equal(await page.locator('#review-settings').isVisible(), false); await page.mouse.wheel(0, 700); await page.waitForTimeout(100); assert.ok(await page.evaluate(() => scrollY) > 0); await noOverflow(page); }
  finally { await context.close(); }
  return { short, noJavaScript: { cards: 6, nativeScroll: true } };
});

let next = 0;
await Promise.all(Array.from({ length: Math.min(3, Math.max(1, Number(process.env.TUNING_WORKERS) || 3), jobs.length) }, async () => { while (next < jobs.length) await jobs[next++](); }));
results.push({ name: 'no browser or asset errors', status: faults.length ? 'FAIL' : 'PASS', ...(faults.length ? { message: JSON.stringify(faults) } : { detail: { faults: 0 } }) });
const counts = { pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length, total: results.length };
let revision = null; try { const response = await fetch(new URL('revision.json', baseURL)); if (response.ok) revision = await response.json(); } catch {}
const report = { checkedAt: new Date().toISOString(), baseURL, revision, engine: 'Chromium ' + browser.version(), counts, results, faults, notes: ['Trusted CDP touch, Playwright mouse wheel, buttons, and keyboard in Chromium; independent cases run with at most three contexts.', 'Browser frame measurements allow 70ms below and 180ms above the configured duration for frame scheduling and sampling.', 'Physical phones, touchscreens, trackpads, native Safari/Firefox/Edge, and OS long-press/selection behavior remain unverified.', 'Existing historical drag-tracking browser checks describe an earlier interaction contract; this suite checks the tunable command-swipe contract.'] };
await browser.close();
await writeFile(path.join(output, 'tuning-results.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(path.join(output, 'tuning-results.md'), '# Tuning browser checks\n\n' + counts.pass + ' PASS / ' + counts.fail + ' FAIL / ' + counts.total + ' total\n\n' + results.map(r => '- ' + r.status + ': ' + r.name + (r.message ? ' — ' + r.message : '')).join('\n') + '\n\n' + report.notes.map(n => '- ' + n).join('\n') + '\n');
console.log(JSON.stringify({ ...counts, evidence: output }));
if (counts.fail) process.exitCode = 1;
