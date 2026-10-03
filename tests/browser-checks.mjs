import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';

// This checks browser behavior, not real-device touch/keyboard performance.
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4188';
const output = path.resolve(process.env.EVIDENCE_DIR || 'verification/local');
const modulePath = process.env.PW_MODULE || 'C:/Users/pgche/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const pw = await import(modulePath.startsWith('file:') ? modulePath : pathToFileURL(modulePath).href);
const browserRoot = process.env.PW_BROWSERS || 'C:/Users/pgche/AppData/Local/ms-playwright';
const results = [];
const faults = [];
const requests = [];
const notes = [];
await mkdir(output, { recursive: true });

// Installed WebKit and the runtime package can differ. Bound the complete engine
// attempt in a child process, including startup and shutdown protocol handshakes.
if (process.argv.includes('--webkit-smoke')) {
  try {
    await webkitSmoke();
    console.log(JSON.stringify({ status: 'PASS', notes, faults }));
    process.exit(faults.length ? 1 : 0);
  } catch (error) {
    console.error(error.stack);
    process.exit(1);
  }
}

function monitor(page) {
  page.on('pageerror', error => faults.push({ type: 'pageerror', message: error.message }));
  page.on('console', msg => { if (msg.type() === 'error') faults.push({ type: 'console', message: msg.text() }); });
  page.on('requestfailed', request => faults.push({ type: 'requestfailed', url: request.url(), message: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) faults.push({ type: 'http', url: response.url(), status: response.status() }); });
  page.on('request', request => requests.push({ method: request.method(), url: request.url(), type: request.resourceType() }));
}
async function check(name, operation) {
  if (process.env.CHECK_FILTER && !new RegExp(process.env.CHECK_FILTER).test(name)) return;
  try {
    const detail = await operation();
    results.push({ name, status: 'PASS', ...(detail ? { detail } : {}) });
    console.log(`PASS ${name}${detail ? `: ${JSON.stringify(detail)}` : ''}`);
  } catch (error) {
    results.push({ name, status: 'FAIL', message: error.message, stack: error.stack });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}
async function shot(page, name, fullPage = false) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage });
}
async function state(page) {
  return page.evaluate(() => ({ mode: document.body.dataset.mode, state: document.querySelector('#deck-stage').dataset.deckState, position: Number(document.querySelector('#deck-stage').dataset.deckPosition), active: document.querySelector('.card[data-active]')?.id, focus: document.activeElement?.id }));
}
async function settled(page, index) {
  await page.waitForFunction(i => {
    const stage = document.querySelector('#deck-stage');
    return stage.dataset.deckState === 'idle' && Math.abs(Number(stage.dataset.deckPosition) - i) < .001;
  }, index, { timeout: 4000 });
}
async function blankPoint(page) {
  return page.evaluate(() => {
    const card = document.querySelector('.card[data-active]');
    const r = card.getBoundingClientRect();
    const excluded = 'a,button,input,textarea,select,option,label,summary,[contenteditable],[role="button"],p,h1,h2,h3,h4,h5,h6,li,span,strong,em,small,blockquote,code,pre,dt,dd';
    for (const fraction of [.7, .55, .85, .4]) {
      const x = r.right - 12, y = r.top + r.height * fraction;
      const hit = document.elementFromPoint(x, y);
      if (card.contains(hit) && !hit.closest(excluded)) return { x, y, hit: hit.className };
    }
    throw new Error('No blank gesture area found');
  });
}
async function pageHasNoHorizontalOverflow(page) {
  const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  assert.ok(sizes.scroll <= sizes.client + 1, `horizontal overflow ${JSON.stringify(sizes)}`);
}

// Each new regression owns its browser context: review cookies and URL overrides
// must never affect the original navigation/form checks or another regression.
async function isolated(options, operation, suffix = '') {
  const context = await chromium.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, ...options });
  const page = await context.newPage(); monitor(page);
  page.setDefaultTimeout(8000);
  try {
    await page.goto(baseURL + suffix); await page.waitForTimeout(450);
    return await operation(page, context);
  } finally { await context.close(); }
}
async function textPoint(page) {
  return page.locator('.card[data-active] h1,.card[data-active] h2').evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el);
    const r = range.getClientRects()[0];
    const x = r.left + Math.min(24, r.width / 2), y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    if (!el.contains(hit)) throw new Error('Text gesture point is obscured');
    return { x, y, hit: hit.id || hit.tagName };
  });
}
async function touch(session, type, points = []) {
  await session.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ id: p.id ?? 1, x: p.x, y: p.y })) });
}
async function touchTravel(page, session, start, travel, hold = 0) {
  await touch(session, 'touchMove', [{ x: start.x, y: start.y - travel }]);
  await page.waitForTimeout(hold || 35);
}
async function settingsValues(page) {
  return page.evaluate(() => ({ preset: document.querySelector('#motion-preset').value, desktop: document.querySelector('#desktop-layout').value, reduce: document.querySelector('#reduce-motion').checked, debug: document.querySelector('#show-debug').checked, panel: document.querySelector('#review-settings').open }));
}
async function animationProbe(page) {
  await page.addInitScript(() => {
    window.__entranceOptions = []; window.__observerOptions = []; window.__intersectionReports = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function(frames, options) {
      if (this.matches('.card')) window.__entranceOptions.push({ id: this.id, frames, options, time: performance.now(), rect: this.getBoundingClientRect().toJSON() });
      return animate.call(this, frames, options);
    };
    const Observer = IntersectionObserver;
    window.IntersectionObserver = class extends Observer {
      constructor(callback, options) {
        window.__observerOptions.push(options);
        super((entries, observer) => {
          window.__intersectionReports.push(...entries.map(entry => ({ id: entry.target.id, ratio: entry.intersectionRatio, intersecting: entry.isIntersecting, time: performance.now() })));
          callback(entries, observer);
        }, options);
      }
    };
  });
}

const chromium = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || path.join(browserRoot, 'chromium-1228/chrome-win64/chrome.exe') });
notes.push(`Chromium ${chromium.version()}; installed browser executable explicitly selected.`);
await check('cold direct section links preserve destination', async () => {
  for (const [index, id] of ['top', 'services', 'how-it-works', 'example', 'working-together', 'contact'].entries()) {
    const context = await chromium.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage(); monitor(page);
    try {
      await page.goto(baseURL + `#${id}`); await page.waitForTimeout(500);
      await settled(page, index);
      assert.equal((await state(page)).active, id);
    } finally { await context.close(); }
  }
});

await check('native-dispatched touch text and background paths reverse, release, and respect bounds in every preset', async () => {
  const measurements = [];
  for (const preset of ['balanced', 'crisp', 'gentle']) for (const area of ['text', 'background']) {
    await isolated({}, async (page, context) => {
      const session = await context.newCDPSession(page);
      await page.locator('#next-card').click(); await settled(page, 1);
      const point = area === 'text' ? textPoint : blankPoint;
      for (const direction of [1, -1]) {
        const start = await point(page);
        await touch(session, 'touchStart', [start]);
        await touchTravel(page, session, start, direction * 30, 100);
        const first = await state(page);
        assert.equal(first.state, 'dragging');
        assert.ok(direction * (first.position - 1) > .1);
        const poses = await page.locator('.card').evaluateAll(cards => cards.map(card => card.style.transform));
        await touchTravel(page, session, start, direction * 52, 100);
        assert.ok(direction * ((await state(page)).position - first.position) > .1);
        await touchTravel(page, session, start, direction * 30, 120);
        assert.deepEqual(await page.locator('.card').evaluateAll(cards => cards.map(card => card.style.transform)), poses);
        await touch(session, 'touchEnd'); await settled(page, 1);
        const commit = await point(page);
        await touch(session, 'touchStart', [commit]);
        await touchTravel(page, session, commit, direction * 92, 140);
        await touch(session, 'touchEnd'); await settled(page, 1 + direction);
        if (!(await page.locator('#go-top').isDisabled())) await page.locator('#go-top').click();
        await settled(page, 0);
        await page.locator('#next-card').click(); await settled(page, 1);
        measurements.push({ preset, area, direction, reversibleProgress: first.position });
      }
      const flick = await point(page); await touch(session, 'touchStart', [flick]);
      await touchTravel(page, session, flick, 12, 10); await touchTravel(page, session, flick, 36, 1);
      const released = Date.now(); await touch(session, 'touchEnd'); await settled(page, 2);
      const duration = Date.now() - released;
      assert.ok(duration >= 200 && duration <= 500, `native-dispatched ${preset} flick settlement ${duration}ms`);
      measurements.push({ preset, area, flickPixels: 36, settlementMilliseconds: duration });
      await page.locator('#go-top').click(); await settled(page, 0);
      const start = await point(page); await touch(session, 'touchStart', [start]);
      await touchTravel(page, session, start, -80, 130); assert.equal((await state(page)).position, 0);
      await touch(session, 'touchEnd'); await settled(page, 0);
      await page.locator('.header-contact').click(); await settled(page, 5);
      const end = await point(page); await touch(session, 'touchStart', [end]);
      await touchTravel(page, session, end, 80, 130); assert.equal((await state(page)).position, 5);
      await touch(session, 'touchEnd'); await settled(page, 5);
      await session.detach();
    }, `?preset=${preset}`);
  }
  return { measurements, method: 'Chromium CDP touch input; hardware touch and native Safari/Android remain unverified' };
});

await check('touch implicit capture transfers to stage and genuine capture loss cancels', async () => isolated({}, async (page, context) => {
  const session = await context.newCDPSession(page);
  await page.evaluate(() => {
    window.__captures = [];
    for (const type of ['pointerdown', 'gotpointercapture', 'lostpointercapture']) document.addEventListener(type, event => {
      window.__captures.push({ type, target: event.target.id || event.target.tagName, pointerId: event.pointerId });
      if (type === 'pointerdown') window.__touchPointerId = event.pointerId;
    }, true);
  });
  const start = await textPoint(page);
  await touch(session, 'touchStart', [start]); await touchTravel(page, session, start, 30);
  // A second movement processes Chromium's pending capture transfer.
  await touchTravel(page, session, start, 40);
  assert.equal((await state(page)).state, 'dragging');
  const captures = await page.evaluate(() => window.__captures);
  assert.ok(captures.some(e => e.type === 'gotpointercapture' && e.target === start.hit), 'text target receives native implicit capture');
  assert.ok(captures.some(e => e.type === 'lostpointercapture' && e.target === start.hit), 'implicit capture is released during transfer');
  assert.ok(captures.some(e => e.type === 'gotpointercapture' && e.target === 'deck-stage'), 'stage gains explicit capture');
  await page.evaluate(() => document.querySelector('#deck-stage').releasePointerCapture(window.__touchPointerId));
  await touchTravel(page, session, start, 45); await settled(page, 0);
  await touch(session, 'touchEnd'); await settled(page, 0);
  await session.detach(); return { captures, method: 'Native Chromium touch dispatch and releasePointerCapture, not synthetic lostpointercapture' };
}));

await check('early touch selection attempt allows swipe while a held touch yields to selection', async () => isolated({}, async (page, context) => {
  const session = await context.newCDPSession(page);
  const attemptSelection = () => page.locator('#hero-title').evaluate(el => {
    const event = new Event('selectstart', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return { defaultPrevented: event.defaultPrevented, collapsed: window.getSelection().isCollapsed };
  });
  let start = await textPoint(page);
  await touch(session, 'touchStart', [start]); await page.waitForTimeout(100);
  const early = await attemptSelection();
  assert.equal(early.defaultPrevented, true, 'pending touch candidate suppresses early accidental selection');
  assert.equal(early.collapsed, true);
  await touchTravel(page, session, start, 40);
  const drag = await state(page);
  assert.equal(drag.state, 'dragging'); assert.ok(drag.position > .2);
  assert.equal(await page.evaluate(() => window.getSelection().isCollapsed), true);
  await touch(session, 'touchCancel'); await settled(page, 0);
  start = await textPoint(page); await touch(session, 'touchStart', [start]);
  await page.waitForTimeout(410);
  const held = await attemptSelection();
  assert.equal(held.defaultPrevented, false, 'held touch permits native selection');
  await touchTravel(page, session, start, 40);
  assert.equal((await state(page)).state, 'idle'); assert.equal((await state(page)).position, 0);
  await touch(session, 'touchEnd'); await settled(page, 0);
  await page.evaluate(() => window.getSelection().removeAllRanges());
  // Mouse text-selection remains native even though the same text is a touch
  // candidate. Synthetic selectstart tests cancellation policy, not OS UI.
  start = await textPoint(page); await page.mouse.move(start.x, start.y); await page.mouse.down();
  const mouse = await attemptSelection(); assert.equal(mouse.defaultPrevented, false);
  await page.mouse.up(); await settled(page, 0);
  await session.detach();
  return { early, held, mouse, dragProgress: drag.position, method: 'selectstart events explicitly synthetic; movement uses Chromium CDP touch input. Native device selection and long-press UI remain unverified.' };
}));

await check('touch hold, context menu, horizontal intent, and additional touch cancel cleanly', async () => isolated({}, async (page, context) => {
  const session = await context.newCDPSession(page);
  let start = await textPoint(page);
  await touch(session, 'touchStart', [start]); await page.waitForTimeout(650);
  assert.equal((await state(page)).state, 'idle');
  await touch(session, 'touchEnd'); await settled(page, 0);
  await page.evaluate(() => window.getSelection().removeAllRanges());
  start = await textPoint(page); await touch(session, 'touchStart', [start]);
  await touchTravel(page, session, start, 32);
  await page.locator('#hero-title').dispatchEvent('contextmenu', { clientX: start.x, clientY: start.y, pointerType: 'touch' });
  await settled(page, 0); await touch(session, 'touchEnd');
  start = await textPoint(page); await touch(session, 'touchStart', [start]);
  await touch(session, 'touchMove', [{ x: start.x + 42, y: start.y - 7 }]); await page.waitForTimeout(100);
  await touch(session, 'touchEnd'); await settled(page, 0);
  start = await textPoint(page); await touch(session, 'touchStart', [start]); await touchTravel(page, session, start, 40);
  const control = await page.locator('#next-card').boundingBox();
  assert.ok(control); const second = { x: control.x + control.width / 2, y: control.y + control.height / 2, id: 2 };
  await touch(session, 'touchStart', [{ x: start.x, y: start.y - 40, id: 1 }, second]);
  await settled(page, 0); await touch(session, 'touchEnd'); await settled(page, 0);
  await page.touchscreen.tap(second.x, second.y); await settled(page, 1);
  await session.detach();
  return { method: 'Chromium CDP hold, horizontal and two-touch input; contextmenu event explicitly synthetic; real long-press UI unverified' };
}));

await check('two-touch pinch preserves browser zoom and cancels deck gesture', async () => isolated({}, async (page, context) => {
  const session = await context.newCDPSession(page);
  const start = await textPoint(page);
  const deckAction = await page.locator('#deck-stage').evaluate(el => getComputedStyle(el).touchAction);
  assert.ok(deckAction.includes('pinch-zoom'), 'deck permits native pinch zoom');
  await touch(session, 'touchStart', [start]); await touchTravel(page, session, start, 30);
  await touch(session, 'touchStart', [{ x: 130, y: 420, id: 1 }, { x: 230, y: 420, id: 2 }]);
  await settled(page, 0);
  for (let i = 1; i <= 6; i++) {
    await touch(session, 'touchMove', [{ x: 130 - i * 7, y: 420, id: 1 }, { x: 230 + i * 7, y: 420, id: 2 }]);
    await page.waitForTimeout(35);
  }
  await touch(session, 'touchEnd'); await page.waitForTimeout(150);
  const zoom = await page.evaluate(() => ({ scale: visualViewport.scale, action: getComputedStyle(document.querySelector('#deck-stage')).touchAction }));
  assert.ok(zoom.action === 'auto' || zoom.action.includes('pinch-zoom'), 'zoomed document continues to permit browser zoom');
  // CDP desktop touch dispatch does not reliably apply pinch page scaling.
  if (zoom.scale <= 1) notes.push('Native-dispatched two-touch input cancelled the deck; Chromium CDP did not apply pinch scale. Real pinch zoom remains unverified.');
  assert.ok((await state(page)).state !== 'dragging'); await session.detach();
  return { ...zoom, deckAction, method: 'Chromium CDP two-touch emulation; actual browser pinch scaling is observational, not real-device validation' };
}));

await check('all review controls and panel persist, reload starts at top, fresh links survive', async () => isolated({}, async (page, context) => {
  await page.locator('#review-settings summary').click();
  await page.locator('#motion-preset').selectOption('gentle');
  await page.locator('#desktop-layout').selectOption('conventional');
  await page.locator('#show-debug').check(); await page.locator('#reduce-motion').check();
  const expected = { preset: 'gentle', desktop: 'conventional', reduce: true, debug: true, panel: true };
  assert.deepEqual(await settingsValues(page), expected);
  const cookies = await context.cookies();
  const cookie = cookies.find(c => c.name === 'lynn_review_settings'); assert.ok(cookie);
  const saved = JSON.parse(decodeURIComponent(cookie.value));
  assert.deepEqual(saved, { version: 1, preset: 'gentle', desktop: 'conventional', reduce: true, debug: true, panelOpen: true });
  await page.reload(); await page.waitForTimeout(180);
  assert.deepEqual(await settingsValues(page), expected, 'open review panel also survives reload');
  await page.locator('#review-settings summary').click();
  await page.locator('.header-contact').click(); await page.waitForTimeout(120);
  await page.reload(); await page.waitForTimeout(150);
  assert.deepEqual(await settingsValues(page), { ...expected, panel: false });
  assert.ok(await page.evaluate(() => scrollY < 50), 'reload returns to first card in flow');
  assert.equal(new URL(page.url()).hash, '#top');
  const fresh = await context.newPage(); await fresh.goto(baseURL + '#working-together'); await fresh.waitForTimeout(150);
  assert.equal(new URL(fresh.url()).hash, '#working-together');
  assert.ok(await fresh.locator('#working-together').evaluate(el => Math.abs(el.getBoundingClientRect().top - 28) < 50));
  await fresh.close();
  await page.locator('#review-settings summary').click(); await page.locator('#reset-review-settings').click();
  assert.deepEqual(await settingsValues(page), { preset: 'balanced', desktop: 'staggered', reduce: false, debug: false, panel: true });
  assert.equal((await context.cookies()).some(c => c.name === 'lynn_review_settings'), false);
  await page.reload(); await page.waitForTimeout(450); await settled(page, 0);
  assert.deepEqual(await settingsValues(page), { preset: 'balanced', desktop: 'staggered', reduce: false, debug: false, panel: false });
  return { cookieKeys: Object.keys(saved), cookiesExcludeCardAndContactDraft: true };
}));

await check('query settings override valid cookies, invalid inputs fall back, blocked cookies remain usable', async () => {
  const origin = new URL(baseURL).origin;
  const valid = { version: 1, preset: 'gentle', desktop: 'conventional', reduce: true, debug: true, panelOpen: true };
  await isolated({}, async (page, context) => {
    await context.addCookies([{ name: 'lynn_review_settings', value: encodeURIComponent(JSON.stringify(valid)), url: origin }]);
    await page.goto(baseURL + '?preset=crisp&desktop=staggered&motion=normal&debug=0'); await page.waitForTimeout(450);
    const values = await settingsValues(page);
    assert.equal(values.preset, 'crisp'); assert.equal(values.desktop, 'staggered'); assert.equal(values.reduce, false); assert.equal(values.debug, false);
    await page.goto(baseURL + '?preset=invalid&desktop=invalid&motion=invalid&debug=invalid'); await page.waitForTimeout(450);
    assert.deepEqual(await settingsValues(page), { preset: 'gentle', desktop: 'conventional', reduce: true, debug: true, panel: true });
    await context.addCookies([{ name: 'lynn_review_settings', value: '%bad-json', url: origin }]);
    await page.goto(baseURL); await page.waitForTimeout(450);
    assert.deepEqual(await settingsValues(page), { preset: 'balanced', desktop: 'staggered', reduce: false, debug: false, panel: false });
  });
  await isolated({}, async page => {
    await page.addInitScript(() => Object.defineProperty(Document.prototype, 'cookie', { configurable: true, get() { throw new DOMException('Cookie access blocked', 'SecurityError'); }, set() { throw new DOMException('Cookie access blocked', 'SecurityError'); } }));
    await page.reload(); await page.waitForTimeout(450);
    await page.locator('#review-settings summary').click(); await page.locator('#motion-preset').selectOption('crisp');
    assert.equal((await settingsValues(page)).preset, 'crisp');
    assert.match(await page.locator('#review-persistence-status').textContent(), /unavailable|blocked|cannot|not saved|could not/i);
    await page.locator('#review-settings summary').click(); await page.locator('#next-card').click(); await settled(page, 1);
    await page.reload(); await page.waitForTimeout(450); await settled(page, 0);
    assert.equal((await settingsValues(page)).preset, 'balanced');
  });
  return { method: 'Blocked cookie accessor emulates browser storage denial' };
});
const viewports = [
  ['desktop-1440', 1440, 1000, 'flow'], ['desktop-1280', 1280, 900, 'flow'],
  ['mobile-390', 390, 844, 'deck'], ['mobile-320', 320, 568, 'flow'],
  ['landscape-844', 844, 390, 'flow'], ['breakpoint-899', 899, 900, 'deck'], ['breakpoint-900', 900, 900, 'flow'],
];
for (const [name, width, height, mode] of viewports) {
  await check(`viewport ${name}`, async () => {
    const context = await chromium.newContext({ viewport: { width, height } });
    const page = await context.newPage(); monitor(page);
    try {
      await page.goto(baseURL); await page.waitForTimeout(450);
      const actual = await state(page);
      assert.equal(actual.mode, mode);
      await pageHasNoHorizontalOverflow(page);
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('#deck-stage > section').count(), 6);
      if (mode === 'flow') assert.equal(await page.locator('.card[inert]').count(), 0);
      await shot(page, name, mode === 'flow');
      return actual;
    } finally { await context.close(); }
  });
}

await check('desktop comparison and native scrolling', async () => {
  const context = await chromium.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(); monitor(page);
  try {
    await page.goto(baseURL); await page.waitForTimeout(350);
    const order = await page.locator('.card').evaluateAll(cards => cards.map(c => c.id));
    await page.mouse.wheel(0, 750); await page.waitForTimeout(400);
    assert.ok(await page.evaluate(() => scrollY > 200));
    await page.mouse.wheel(0, -2000); await page.waitForTimeout(400);
    assert.equal(await page.locator('#top').evaluate(c => getComputedStyle(c).opacity), '1');
    await page.locator('#review-settings summary').click();
    await page.locator('#desktop-layout').selectOption('conventional');
    assert.equal(await page.locator('body').getAttribute('data-desktop'), 'conventional');
    assert.deepEqual(await page.locator('.card').evaluateAll(cards => cards.map(c => c.id)), order);
    await page.locator('#review-settings summary').click();
    await shot(page, 'desktop-conventional', true);
    return { order };
  } finally { await context.close(); }
});

await check('desktop entrances wait until 15 percent inside viewport, delay 80 ms, run 380 ms once without flash', async () => isolated({ viewport: { width: 1440, height: 900 } }, async page => {
  await animationProbe(page); await page.reload(); await page.waitForTimeout(500);
  const observer = await page.evaluate(() => window.__observerOptions);
  assert.ok(observer.some(options => options.rootMargin?.split(' ')[2] === '-135px'), JSON.stringify(observer));
  assert.equal(await page.locator('#top').getAttribute('data-entrance'), null, 'first card is immediately revealed');
  const below = await page.locator('#example').evaluate(el => ({ pending: el.dataset.entrance, opacity: getComputedStyle(el).opacity, rect: el.getBoundingClientRect().toJSON() }));
  assert.equal(below.pending, 'pending'); assert.equal(below.opacity, '0');
  await page.evaluate(() => {
    const el = document.querySelector('#example');
    scrollTo(0, scrollY + el.getBoundingClientRect().top - (innerHeight - 100));
  }); await page.waitForTimeout(100);
  assert.equal(await page.locator('#example').getAttribute('data-entrance'), 'pending');
  assert.equal(await page.locator('#example').evaluate(el => getComputedStyle(el).opacity), '0');
  await page.evaluate(() => {
    const el = document.querySelector('#example');
    scrollTo(0, scrollY + el.getBoundingClientRect().top - (innerHeight - 200));
  });
  await page.waitForFunction(() => window.__entranceOptions.some(a => a.id === 'example'));
  const entry = await page.evaluate(() => window.__entranceOptions.find(a => a.id === 'example'));
  assert.equal(entry.options.delay, 80); assert.equal(entry.options.duration, 380); assert.equal(entry.options.fill, 'backwards');
  const startOpacity = await page.locator('#example').evaluate(el => getComputedStyle(el).opacity);
  assert.ok(Number(startOpacity) < .5, `entrance begins hidden, observed opacity ${startOpacity}`);
  await page.waitForTimeout(520);
  assert.equal(await page.locator('#example').getAttribute('data-entrance'), null);
  assert.equal(await page.locator('#example').evaluate(el => getComputedStyle(el).opacity), '1');
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(100);
  await page.locator('#example').scrollIntoViewIfNeeded(); await page.waitForTimeout(550);
  assert.equal(await page.evaluate(() => window.__entranceOptions.filter(a => a.id === 'example').length), 1);
  return { observer, entrance: entry.options, pendingOpacity: below.opacity };
}));

await check('desktop direct links, resize, conventional layout, and reduced motion reveal reachable content', async () => {
  for (const suffix of ['#example', '?desktop=conventional#example', '?motion=reduce#example']) {
    await isolated({ viewport: { width: 1440, height: 900 } }, async page => {
      assert.equal(await page.locator('#example').getAttribute('data-entrance'), null);
      assert.equal(await page.locator('#example').evaluate(el => getComputedStyle(el).opacity), '1');
      assert.ok(await page.locator('#example').evaluate(el => el.getBoundingClientRect().top < innerHeight));
      await page.setViewportSize({ width: 1280, height: 820 }); await page.waitForTimeout(120);
      assert.equal(await page.locator('#example').evaluate(el => getComputedStyle(el).opacity), '1');
      if (suffix.startsWith('?')) {
        assert.equal(await page.locator('.card[data-entrance=pending]').count(), 0);
        assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      }
    }, suffix);
  }
  await isolated({ viewport: { width: 1440, height: 900 } }, async page => {
    await page.locator('.header-contact').click(); await page.waitForTimeout(80);
    assert.equal(await page.locator('#contact').getAttribute('data-entrance'), null);
    assert.equal(await page.locator('#contact').evaluate(el => getComputedStyle(el).opacity), '1');
    await page.setViewportSize({ width: 390, height: 844 }); await settled(page, 5);
    await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(120);
    assert.equal(await page.locator('#contact').evaluate(el => getComputedStyle(el).opacity), '1');
  });
});

await check('desktop reduced motion while dialog is open suppresses late observer animations', async () => isolated({ viewport: { width: 1440, height: 900 } }, async page => {
  await animationProbe(page); await page.reload(); await page.waitForTimeout(500);
  await page.locator('.header-contact').click(); await page.locator('#open-contact').click();
  await page.waitForTimeout(30); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('#contact-dialog').dataset.phase === 'open', null, { timeout: 250 });
  const count = await page.evaluate(() => window.__entranceOptions.length);
  await page.evaluate(() => scrollTo(0, 0)); await page.setViewportSize({ width: 1280, height: 760 });
  await page.waitForTimeout(550);
  assert.equal(await page.evaluate(() => window.__entranceOptions.length), count);
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
  await page.locator('#close-contact').click(); await page.waitForTimeout(120);
  assert.equal(await page.locator('.card[data-entrance=pending]').count(), 0);
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
}));

await check('desktop cards read in conventional flow stay revealed when staggered layout returns', async () => isolated({ viewport: { width: 1440, height: 900 } }, async page => {
  await page.locator('#review-settings summary').click(); await page.locator('#desktop-layout').selectOption('conventional');
  await page.locator('#review-settings summary').click();
  await page.locator('#working-together').scrollIntoViewIfNeeded(); await page.waitForTimeout(160);
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(120);
  await page.locator('#review-settings summary').click(); await page.locator('#desktop-layout').selectOption('staggered');
  await page.locator('#review-settings summary').click(); await page.waitForTimeout(100);
  assert.equal(await page.locator('#working-together').getAttribute('data-entrance'), null);
  assert.equal(await page.locator('#working-together').evaluate(el => getComputedStyle(el).opacity), '1');
}));

await check('desktop card exactly at entrance observer boundary does not remain pending', async () => isolated({ viewport: { width: 1440, height: 900 } }, async page => {
  await animationProbe(page); await page.reload(); await page.waitForTimeout(500);
  assert.equal(await page.locator('#example').getAttribute('data-entrance'), 'pending');
  const edge = await page.evaluate(() => {
    const card = document.querySelector('#example');
    const boundary = innerHeight - Math.round(innerHeight * .15);
    scrollTo(0, scrollY + card.getBoundingClientRect().top - boundary);
    // Browser scroll offsets round to integer CSS pixels while font geometry is
    // fractional. Compensate that subpixel remainder in this test only.
    card.style.transform = `translateY(${boundary - card.getBoundingClientRect().top}px)`;
    return card.getBoundingClientRect().top;
  });
  await page.waitForFunction(() => document.querySelector('#example').dataset.entrance !== 'pending', null, { timeout: 1000 });
  const report = await page.evaluate(() => window.__intersectionReports.filter(e => e.id === 'example').at(-1));
  assert.equal(report.intersecting, true); assert.equal(report.ratio, 0);
  return { edge, report, method: 'Chromium exact boundary with test-only subpixel compensation for integer scroll offsets' };
}));

await check('contact opening during deck settlement freezes position and inside-to-outside release stays open', async () => isolated({}, async page => {
  await page.locator('#next-card').evaluate(el => el.click()); await page.waitForTimeout(70);
  assert.equal((await state(page)).state, 'settling');
  // Calling the real opener listener avoids automation waiting for an inert card.
  await page.locator('#open-contact').evaluate(el => el.click());
  const frozen = await state(page);
  assert.equal(frozen.state, 'idle');
  await page.waitForTimeout(400); assert.equal((await state(page)).position, frozen.position);
  assert.equal(await page.locator('#contact-dialog').getAttribute('data-phase'), 'open');
  const inside = await page.locator('#dialog-title').boundingBox();
  await page.mouse.move(inside.x + 12, inside.y + 12); await page.mouse.down();
  await page.mouse.move(2, 2); await page.mouse.up(); await page.waitForTimeout(350);
  assert.equal(await page.locator('#contact-dialog').evaluate(el => el.open), true);
  await page.locator('#close-contact').click(); await page.waitForTimeout(350);
  assert.equal(await page.locator('#contact-dialog').evaluate(el => el.open), false);
  return { frozenPosition: frozen.position };
}));

await check('live OS reduced motion finishes contact opening and closing immediately', async () => isolated({}, async page => {
  await page.locator('.header-contact').click(); await settled(page, 5);
  await page.locator('#open-contact').evaluate(el => el.click()); await page.waitForTimeout(35);
  assert.equal(await page.locator('#contact-dialog').getAttribute('data-phase'), 'opening');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('#contact-dialog').dataset.phase === 'open', null, { timeout: 200 });
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForTimeout(60);
  await page.locator('#close-contact').evaluate(el => el.click()); await page.waitForTimeout(35);
  assert.equal(await page.locator('#contact-dialog').getAttribute('data-phase'), 'closing');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => !document.querySelector('#contact-dialog').open, null, { timeout: 200 });
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
  assert.equal((await state(page)).mode, 'flow');
}));

const context = await chromium.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const page = await context.newPage(); monitor(page);
page.setDefaultTimeout(8000);
await page.goto(baseURL); await page.waitForTimeout(450);

await check('initial boundaries and keyboard navigation', async () => {
  assert.equal(await page.locator('#previous-card').isDisabled(), true);
  assert.equal(await page.locator('#go-top').isDisabled(), true);
  await page.locator('#next-card').click(); await settled(page, 1);
  assert.equal((await state(page)).focus, 'services-title');
  await page.keyboard.press('ArrowDown'); await settled(page, 2);
  assert.equal((await state(page)).focus, 'process-title');
  await page.keyboard.press('ArrowUp'); await settled(page, 1);
  await page.keyboard.press('Home'); await settled(page, 0);
});

await check('slow reversible pointer path with partial release', async () => {
  const start = await blankPoint(page);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x, start.y - 30, { steps: 8 }); await page.waitForTimeout(100);
  const forward = await page.locator('#services').evaluate(el => el.style.transform);
  const first = await state(page);
  assert.equal(first.state, 'dragging'); assert.ok(first.position > .15 && first.position < .4);
  await page.mouse.move(start.x, start.y - 55, { steps: 8 }); await page.waitForTimeout(150);
  const further = await state(page); assert.ok(further.position > first.position);
  await shot(page, 'gesture-mid-drag');
  await page.mouse.move(start.x, start.y - 30, { steps: 8 }); await page.waitForTimeout(150);
  const reversed = await page.locator('#services').evaluate(el => el.style.transform);
  assert.equal(reversed, forward, 'same scalar progress must recreate the same transform');
  await page.waitForTimeout(120); await page.mouse.up(); await settled(page, 0);
  assert.equal(await page.evaluate(() => window.getSelection().isCollapsed), true, 'blank-area mouse drag must not select card text');
  return { start, forwardProgress: first.position, peakProgress: further.position, identicalReversalTransform: true };
});

await check('short flick commits and settles within 200–400 ms', async () => {
  const start = await blankPoint(page);
  await page.evaluate(() => {
    window.__flickSamples = [];
    window.__recordFlick = event => window.__flickSamples.push({ type: event.type, time: event.timeStamp, y: event.clientY });
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) document.addEventListener(type, window.__recordFlick);
  });
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x, start.y - 12); await page.waitForTimeout(10);
  await page.mouse.move(start.x, start.y - 36);
  const started = Date.now(); await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('#deck-stage').dataset.deckState === 'idle', null, { polling: 'raf', timeout: 1000 });
  const elapsed = Date.now() - started;
  const samples = await page.evaluate(() => {
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) document.removeEventListener(type, window.__recordFlick);
    return window.__flickSamples;
  });
  await settled(page, 1);
  assert.ok(elapsed >= 190 && elapsed <= 430, `observed browser settlement ${elapsed}ms includes automation overhead`);
  assert.equal(await page.evaluate(() => window.getSelection().isCollapsed), true);
  return { travelPixels: 36, measuredMilliseconds: elapsed, samples };
});

await check('full traversal keeps settled geometry stable', async () => {
  const centers = [];
  const exposedEdges = [];
  for (let i = 1; i <= 5; i++) {
    if (i > 1) { await page.locator('#next-card').click(); await settled(page, i); }
    centers.push(await page.locator('.card[data-active]').evaluate(el => { const r = el.getBoundingClientRect(); return r.y + r.height / 2; }));
    const edges = await page.locator('.card').evaluateAll((cards, index) => {
      const top = cards[index].getBoundingClientRect().top;
      return [1, 2].filter(depth => index >= depth).map(depth => ({ depth, exposedPixels: top - cards[index - depth].getBoundingClientRect().top }));
    }, i);
    for (const edge of edges) assert.ok(Math.abs(edge.exposedPixels - edge.depth * 10) < .5, `card ${i} exposed stack edge ${JSON.stringify(edge)}`);
    exposedEdges.push({ index: i, edges });
  }
  assert.ok(Math.max(...centers) - Math.min(...centers) < .5);
  assert.equal(await page.locator('#next-card').isDisabled(), true);
  assert.equal(await page.locator('.card:not([inert])').count(), 1);
  await shot(page, 'mobile-contact-card');
  await page.locator('#go-top').click(); await settled(page, 0);
  return { centers, exposedEdges };
});

await check('rapid input retains at most one pending transition', async () => {
  await page.locator('#next-card').evaluate(button => { for (let i = 0; i < 18; i++) button.click(); });
  await page.waitForTimeout(850); await settled(page, 2);
  await page.locator('#go-top').click(); await settled(page, 0);
});

await check('pointer cancellation returns to origin', async () => {
  const start = await blankPoint(page);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x, start.y - 70, { steps: 10 }); await page.waitForTimeout(40);
  assert.equal((await state(page)).state, 'dragging');
  await page.locator('#deck-stage').dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true });
  await page.mouse.up(); await settled(page, 0);
  return { method: 'real mouse drag with synthetic pointercancel; native touch cancellation unverified' };
});

await check('emulated touch cancellation clears pointer and deck state', async () => {
  const start = await blankPoint(page);
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x, y: start.y, id: 1 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x, y: start.y - 36, id: 1 }] });
  await page.waitForTimeout(50);
  assert.equal((await state(page)).state, 'dragging');
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await settled(page, 0); await session.detach();
  return { method: 'Chromium CDP touch events; real-device touch cancellation remains unverified' };
});

await check('resize settles drag and switches short viewport to flow', async () => {
  const start = await blankPoint(page);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x, start.y - 30, { steps: 5 }); await page.waitForTimeout(30);
  await page.setViewportSize({ width: 844, height: 390 }); await page.mouse.up(); await page.waitForTimeout(100);
  assert.equal((await state(page)).mode, 'flow');
  assert.equal(await page.locator('.card[inert]').count(), 0);
  await page.setViewportSize({ width: 390, height: 844 }); await settled(page, 0);
});

await check('Read as page and card return preserve section', async () => {
  await page.locator('#next-card').click(); await settled(page, 1);
  await page.locator('#read-mode').click(); await page.waitForTimeout(250);
  assert.equal((await state(page)).mode, 'flow');
  assert.equal(await page.locator('.card[inert]').count(), 0);
  await page.locator('#read-mode').click(); await settled(page, 1);
});

const draft = { name: 'Preview Tester', email: 'preview@example.test', message: 'A first paragraph for the proof of concept.\n\n' + 'A longer message stays available for local review and editing. '.repeat(38) };
let interactionRequests;
await check('contact direct jump, expansion, title focus, modal keyboard containment', async () => {
  await page.locator('.header-contact').click(); await settled(page, 5);
  assert.equal((await state(page)).focus, 'open-contact');
  interactionRequests = requests.length;
  await page.locator('#open-contact').click();
  await page.waitForTimeout(90); await shot(page, 'contact-expanding');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#contact-dialog').evaluate(el => el.open), true);
  assert.equal((await state(page)).focus, 'dialog-title');
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.querySelector('#contact-dialog').contains(document.activeElement)), true);
  }
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.querySelector('#contact-dialog').contains(document.activeElement)), true);
  }
  assert.equal((await state(page)).position, 5);
  await shot(page, 'contact-details');
});

await check('validation summary and invalid email preserve values', async () => {
  await page.getByRole('button', { name: 'Review inquiry' }).click();
  assert.equal(await page.locator('#error-summary').isVisible(), true);
  assert.equal((await state(page)).focus, 'error-summary');
  assert.equal(await page.locator('#error-summary a').count(), 3);
  await page.locator('#error-summary a').first().click(); assert.equal((await state(page)).focus, 'name');
  await page.locator('#name').fill(draft.name); await page.locator('#email').fill('invalid');
  await page.locator('#message').fill(draft.message);
  await page.getByRole('button', { name: 'Review inquiry' }).click();
  assert.equal(await page.locator('#email').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#name').inputValue(), draft.name);
  await shot(page, 'contact-validation');
});

await check('2000+ character message, optional blank organization, review and edit', async () => {
  await page.locator('#email').fill(draft.email);
  assert.ok(draft.message.length >= 2000);
  await page.locator('#message').focus(); await page.keyboard.press('Control+A');
  assert.equal(await page.locator('#message').evaluate(el => el.selectionEnd - el.selectionStart), draft.message.length);
  await page.keyboard.press('ArrowDown'); assert.equal((await state(page)).position, 5);
  await page.getByRole('button', { name: 'Review inquiry' }).click();
  assert.equal(await page.locator('[data-review="organization"]').textContent(), 'Not provided');
  assert.equal(await page.locator('[data-review="message"]').textContent(), draft.message.trim());
  assert.equal(await page.locator('[data-review="message"]').evaluate(el => getComputedStyle(el).whiteSpace), 'pre-wrap');
  await shot(page, 'contact-review');
  await page.locator('#edit-details').click();
  assert.equal(await page.locator('#message').inputValue(), draft.message);
  return { messageCharacters: draft.message.length };
});

await check('close and reopen preserve draft, opener focus, and section', async () => {
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  assert.equal(await page.locator('#contact-dialog').evaluate(el => el.open), false);
  assert.equal((await state(page)).focus, 'open-contact');
  assert.equal((await state(page)).position, 5);
  await page.locator('#open-contact').click(); await page.waitForTimeout(400);
  assert.equal(await page.locator('#name').inputValue(), draft.name);
  assert.equal(await page.locator('#message').inputValue(), draft.message);
});

await check('overlay viewport resize locks background mode and keeps fields reachable', async () => {
  await page.setViewportSize({ width: 390, height: 410 }); await page.waitForTimeout(100);
  assert.equal((await state(page)).mode, 'deck');
  await page.locator('#message').focus();
  await page.getByRole('button', { name: 'Review inquiry' }).scrollIntoViewIfNeeded();
  await shot(page, 'contact-short-visible-viewport');
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(100);
  return { method: 'resized browser viewport; real on-screen keyboard unverified' };
});

await check('Finish demo states nothing was sent and makes no submission request', async () => {
  await page.getByRole('button', { name: 'Review inquiry' }).click();
  await page.locator('#finish-demo').click();
  assert.equal(await page.locator('#complete-title').textContent(), 'Demo complete. Nothing was sent.');
  assert.equal((await state(page)).focus, 'complete-title');
  await page.waitForTimeout(200);
  assert.deepEqual(requests.slice(interactionRequests), [], 'contact interactions must trigger no network requests');
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  assert.ok(!page.url().includes(encodeURIComponent(draft.email)));
  await shot(page, 'contact-demo-complete');
  await page.locator('#close-contact').click(); await page.waitForTimeout(400);
});
await context.close();

await check('reduced motion readable flow and immediate modal', async () => {
  const context = await chromium.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); monitor(page);
  try {
    await page.goto(baseURL); await page.waitForTimeout(150);
    assert.equal((await state(page)).mode, 'flow');
    assert.equal(await page.locator('.card[inert]').count(), 0);
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await shot(page, 'reduced-motion', true);
    await page.locator('#open-contact').click();
    assert.equal(await page.locator('#contact-dialog').getAttribute('data-phase'), 'open');
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await page.locator('#close-contact').click();
    assert.equal(await page.locator('#contact-dialog').evaluate(el => el.open), false);
  } finally { await context.close(); }
});

await check('enlarged 200 percent text preserves content in flow', async () => {
  const context = await chromium.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(); monitor(page);
  try {
    await page.goto(baseURL);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' }); await page.waitForTimeout(300);
    assert.equal((await state(page)).mode, 'flow');
    await pageHasNoHorizontalOverflow(page);
    await shot(page, 'enlarged-text-200', true);
  } finally { await context.close(); }
});

await check('two-times page-scale zoom keeps document reachable', async () => {
  const context = await chromium.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(); monitor(page);
  try {
    await page.goto(baseURL);
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 }); await page.waitForTimeout(300);
    const viewport = await page.evaluate(() => ({ scale: visualViewport.scale, height: visualViewport.height, width: visualViewport.width }));
    assert.equal(viewport.scale, 2); assert.equal((await state(page)).mode, 'flow');
    await shot(page, 'zoom-page-scale-200');
    return { ...viewport, method: 'Chromium CDP page-scale emulation; desktop browser UI zoom unverified' };
  } finally { await context.close(); }
});

await check('JavaScript disabled semantic fallback and disabled prototype form', async () => {
  const context = await chromium.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const page = await context.newPage(); monitor(page);
  try {
    await page.goto(baseURL);
    assert.equal(await page.locator('body').getAttribute('data-mode'), 'flow');
    assert.equal(await page.locator('.card').count(), 6);
    for (const card of await page.locator('.card').all()) assert.equal(await card.isVisible(), true);
    assert.equal(await page.locator('#open-contact').isDisabled(), true);
    assert.equal(await page.locator('#contact-fields').evaluate(el => el.disabled), true);
    assert.equal(await page.locator('#contact noscript').isVisible(), true);
    await pageHasNoHorizontalOverflow(page); await shot(page, 'javascript-disabled', true);
  } finally { await context.close(); }
});
if (process.env.RECORD_DEMOS !== '0') {
  await check('focused review recordings including touch text start', async () => {
    for (const name of ['slow-reversible-drag', 'short-flick', 'contact-expansion', 'touch-text-reversal', 'touch-text-flick']) {
      const context = await chromium.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, recordVideo: { dir: output, size: { width: 390, height: 844 } } });
      const page = await context.newPage(); monitor(page);
      await page.goto(baseURL + (name === 'contact-expansion' ? '#contact' : ''));
      await page.waitForTimeout(650);
      if (name === 'contact-expansion') {
        await page.locator('#open-contact').click(); await page.waitForTimeout(900);
        await page.locator('#close-contact').click(); await page.waitForTimeout(750);
      } else if (name.startsWith('touch-text')) {
        const session = await context.newCDPSession(page);
        const start = await textPoint(page);
        await touch(session, 'touchStart', [start]);
        if (name === 'touch-text-reversal') {
          for (const travel of [12, 24, 36, 48, 60, 72, 60, 48, 36, 24, 12]) await touchTravel(page, session, start, travel, 115);
          await page.waitForTimeout(150); await touch(session, 'touchEnd'); await settled(page, 0);
        } else {
          await touchTravel(page, session, start, 12, 10);
          await touchTravel(page, session, start, 36, 1);
          await touch(session, 'touchEnd'); await settled(page, 1);
        }
        await session.detach(); await page.waitForTimeout(700);
      } else {
        const start = await blankPoint(page);
        await page.mouse.move(start.x, start.y); await page.mouse.down();
        if (name === 'slow-reversible-drag') {
          for (const travel of [12, 24, 36, 48, 60, 72, 60, 48, 36, 24, 12]) {
            await page.mouse.move(start.x, start.y - travel); await page.waitForTimeout(115);
          }
          await page.waitForTimeout(150); await page.mouse.up(); await settled(page, 0);
        } else {
          await page.mouse.move(start.x, start.y - 12); await page.waitForTimeout(10);
          await page.mouse.move(start.x, start.y - 36); await page.mouse.up(); await settled(page, 1);
        }
        await page.waitForTimeout(700);
      }
      const video = page.video(); const raw = await video.path();
      await context.close();
      const destination = path.join(output, `${name}.webm`);
      await video.saveAs(destination);
      if (raw !== destination && path.resolve(raw).startsWith(output + path.sep)) await unlink(raw);
    }
    return ['slow-reversible-drag.webm', 'short-flick.webm', 'contact-expansion.webm', 'touch-text-reversal.webm', 'touch-text-flick.webm'];
  });
}
await chromium.close();

async function webkitSmoke() {
  console.log('Launching WebKit smoke checks');
  const browser = await pw.webkit.launch({ timeout: 12000, executablePath: process.env.WEBKIT_PATH || path.join(browserRoot, 'webkit-2287/Playwright.exe') });
  console.log('WebKit launched');
  notes.push(`Playwright WebKit ${browser.version()} on Windows is engine coverage, not native Safari.`);
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      console.log(`WebKit context ${viewport.width} created`);
      context.setDefaultTimeout(8000);
      context.setDefaultNavigationTimeout(12000);
      const page = await context.newPage(); monitor(page);
      console.log(`WebKit page ${viewport.width} created`);
      await page.goto(baseURL); await page.waitForTimeout(450);
      assert.equal((await state(page)).mode, viewport.width < 900 ? 'deck' : 'flow');
      if (viewport.width < 900) { await page.locator('#next-card').click(); await settled(page, 1); }
      await page.locator('.header-contact').click(); await page.waitForTimeout(350);
      await page.locator('#open-contact').click(); await page.waitForTimeout(400);
      assert.equal(await page.locator('#contact-dialog').evaluate(el => el.open), true);
      await page.locator('#name').fill('Engine Preview'); await page.locator('#email').fill('engine@example.test'); await page.locator('#message').fill('A local browser verification message.');
      await page.getByRole('button', { name: 'Review inquiry' }).click(); await page.locator('#finish-demo').click();
      assert.equal(await page.locator('#complete-title').isVisible(), true);
      await shot(page, `webkit-${viewport.width}-complete`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(350);
      assert.equal(await page.locator('#contact-dialog').evaluate(el => el.open), false);
      await context.close();
    }
  } finally { await browser.close(); }
}
if (process.env.SKIP_WEBKIT === '1') {
  results.push({ name: 'WebKit desktop/mobile navigation and form smoke', status: 'UNVERIFIED', message: 'Skipped because local installed WebKit launch created a context but hung creating its first page and exceeded a 25-second process timeout.' });
} else try {
  const { stdout } = await promisify(execFile)(process.execPath, [fileURLToPath(import.meta.url), '--webkit-smoke'], { timeout: 25000, windowsHide: true, maxBuffer: 1024 * 1024 });
  const engine = JSON.parse(stdout.trim().split('\n').at(-1));
  notes.push(...engine.notes); faults.push(...engine.faults);
  results.push({ name: 'WebKit desktop/mobile navigation and form smoke', status: 'PASS' });
  console.log('PASS WebKit desktop/mobile navigation and form smoke');
} catch (error) {
  const detail = `${error.killed ? 'Complete WebKit smoke exceeded a 25-second process timeout.' : error.message} ${error.stdout || ''} ${error.stderr || ''}`.trim();
  results.push({ name: 'WebKit desktop/mobile navigation and form smoke', status: error.killed ? 'UNVERIFIED' : 'FAIL', message: detail });
  notes.push('Installed WebKit 2287 could not complete the bounded browser smoke; native Safari remains unverified.');
  console.log(`${error.killed ? 'UNVERIFIED' : 'FAIL'} WebKit: ${detail}`);
}
notes.push('Firefox, native Safari, Android Chrome, and iPhone Safari are unavailable/unverified in this environment. No real-device performance, browser pinch behavior, or on-screen keyboard claim is made.');
await check('no browser/asset errors or unexpected contact network', async () => {
  assert.deepEqual(faults, []);
  assert.equal(requests.filter(request => request.method !== 'GET').length, 0);
  return { requestsObserved: requests.length, errors: faults.length };
});

let revision = null;
try { revision = await (await fetch(new URL('revision.json', baseURL))).json(); } catch (error) { notes.push(`Revision metadata unavailable: ${error.message}`); }
const report = { checkedAt: new Date().toISOString(), baseURL, revision, results, faults, notes, artifacts: 'PNG captures; slow-reversible-drag.webm, short-flick.webm, contact-expansion.webm, touch-text-reversal.webm, touch-text-flick.webm when RECORD_DEMOS is enabled' };
await writeFile(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(path.join(output, 'browser-results.md'), `# Browser verification\n\nPreview: ${baseURL}\n\nChecked: ${report.checkedAt}\n\n${results.map(r => `- ${r.status}: ${r.name}${r.message ? ` — ${r.message.replaceAll('\n', ' ')}` : ''}`).join('\n')}\n\n${notes.map(n => `- ${n}`).join('\n')}\n\nDetailed results, measurements, errors, and revision metadata: browser-results.json. Screenshots and short focused review recordings are alongside this log.\n`);
console.log(`Evidence: ${output}`);
if (results.some(result => result.status === 'FAIL')) process.exitCode = 1;
