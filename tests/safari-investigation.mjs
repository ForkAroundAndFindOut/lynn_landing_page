import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Browser-input emulation and source/DOM evidence; this is not native Safari or hardware trackpad testing.
const baseURL = process.env.BASE_URL || 'https://codex-card-layout-lynn-landing-page.nrct6ycww6.workers.dev/';
const output = path.resolve(process.env.EVIDENCE_DIR || 'dist/qa-evidence');
const browserName = process.env.QA_BROWSER || 'chromium';
const executables = { chromium: 'C:/Users/pgche/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe', chrome: 'C:/Program Files/Google/Chrome/Application/chrome.exe', edge: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' };
if (!executables[browserName]) throw new Error('QA_BROWSER must be chromium, chrome, or edge');
const modulePath = process.env.PW_MODULE || 'C:/Users/pgche/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(modulePath).href);
const browser = await chromium.launch({ executablePath: process.env.QA_BROWSER_PATH || executables[browserName], timeout: 15000 });
const results = [], faults = [];
await mkdir(output, { recursive: true });
const readState = page => page.evaluate(() => ({ mode: document.body.dataset.mode, reduced: document.body.dataset.reduced, position: Number(document.querySelector('#deck-stage').dataset.deckPosition), state: document.querySelector('#deck-stage').dataset.deckState, requested: Number(document.querySelector('#position').textContent.trim().slice(0, 2)) - 1, rejection: document.querySelector('#deck-stage').dataset.deckRejection }));
async function isolated(options, action, { suffix = '', init, wait = 180 } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...options });
  const page = await context.newPage(); page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(15000);
  page.on('pageerror', error => faults.push({ type: 'pageerror', message: error.message, url: page.url() }));
  page.on('console', message => { if (message.type() === 'error') faults.push({ type: 'console', message: message.text(), url: page.url() }); });
  page.on('requestfailed', request => faults.push({ type: 'requestfailed', url: request.url(), message: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) faults.push({ type: 'http', url: response.url(), status: response.status() }); });
  await page.addInitScript(() => {
    window.__qaInputs = []; window.__qaRequests = []; window.__qaEntrances = [];
    const state = () => { const stage = document.querySelector('#deck-stage'); return { mode: document.body?.dataset.mode, state: stage?.dataset.deckState, position: stage?.dataset.deckPosition, requested: document.querySelector('#position')?.textContent.trim() }; };
    document.addEventListener('wheel', e => {
      const record = { time: performance.now(), eventTimeStamp: e.timeStamp, trusted: e.isTrusted, target: e.target.id || e.target.tagName, targetCard: e.target.closest('.card')?.id || null, deltaY: e.deltaY, deltaMode: e.deltaMode, x: e.clientX, y: e.clientY, before: state() };
      window.__qaInputs.push(record); setTimeout(() => Object.assign(record, { prevented: e.defaultPrevented, after: state() }), 0);
    }, { capture: true, passive: true });
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) { if (this.matches('.card')) window.__qaEntrances.push({ id: this.id, time: performance.now(), frames, options }); return animate.call(this, frames, options); };
    document.addEventListener('DOMContentLoaded', () => { const position = document.querySelector('#position'); new MutationObserver(() => window.__qaRequests.push({ time: performance.now(), ...state() })).observe(position, { childList: true, subtree: true }); });
  });
  if (init) await page.addInitScript(init);
  try {
    await page.goto(baseURL + suffix);
    if (options?.javaScriptEnabled !== false) { await page.locator('#review-settings:not([hidden])').waitFor(); await page.evaluate(() => document.fonts.ready); }
    await page.waitForTimeout(wait);
    return await action(page, context);
  } finally { await context.close(); }
}
async function check(name, action) {
  if (process.env.QA_CHECK_FILTER && !new RegExp(process.env.QA_CHECK_FILTER).test(name)) return;
  try { const detail = await action(); results.push({ name, status: 'PASS', detail }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, status: 'FAIL', message: error.message, stack: error.stack }); console.error('FAIL ' + name + ': ' + error.message); }
}
async function snapshot(page, name, fullPage = false) { await page.screenshot({ path: path.join(output, `${browserName}-${name}.png`), fullPage }); }
async function layoutMetrics(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('#deck-stage'), rect = stage.getBoundingClientRect(), read = document.querySelector('#read-mode');
    return { innerWidth, innerHeight, visualViewport: { width: visualViewport?.width, height: visualViewport?.height, scale: visualViewport?.scale }, mode: document.body.dataset.mode, reduced: document.body.dataset.reduced, note: document.querySelector('#mode-note').textContent, readButton: { text: read.textContent, disabled: read.disabled }, stage: { width: rect.width, height: rect.height, inline: stage.getAttribute('style') }, horizontalOverflow: document.documentElement.scrollWidth - innerWidth, cards: [...document.querySelectorAll('.card')].map(card => ({ id: card.id, scrollHeight: card.scrollHeight, offsetHeight: card.offsetHeight, width: card.offsetWidth, inert: card.inert, visible: getComputedStyle(card).visibility })) };
  });
}

for (const [width, height] of [[390, 539], [390, 540], [390, 541], [390, 667], [390, 740], [390, 844], [390, 915], [844, 390], [539, 844], [540, 844], [541, 844], [899, 900], [900, 900]]) {
  await check(`baseline layout ${width}x${height}`, () => isolated({ viewport: { width, height } }, async page => { const detail = await layoutMetrics(page); assert.equal(detail.cards.length, 6); await snapshot(page, `layout-${width}x${height}`); return detail; }));
}
await check('isolated observation of real per-card fit reads', () => isolated({}, async page => ({ note: 'Native scrollHeight getter is transparently observed in a separate page; no refresh or returned measurement is changed.', reads: await page.evaluate(() => window.__qaFitReads), settled: await layoutMetrics(page) }), { init: () => {
  window.__qaFitReads = [];
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight');
  Object.defineProperty(Element.prototype, 'scrollHeight', { ...descriptor, get() { const value = descriptor.get.call(this); if (this.matches('.card') && document.body.dataset.mode === 'deck') window.__qaFitReads.push({ time: performance.now(), id: this.id, scrollHeight: value, required: value + 2, offsetHeight: this.offsetHeight, stageHeight: document.querySelector('#deck-stage').clientHeight, stageInline: document.querySelector('#deck-stage').getAttribute('style') }); return value; } });
} }));
await check('fit fallback leaves Use card view enabled when height is at least 540', () => isolated({ viewport: { width: 390, height: 740 } }, async page => { const before = await layoutMetrics(page); assert.equal(before.mode, 'flow'); assert.equal(before.readButton.disabled, false); await page.locator('#read-mode').click(); const after = await layoutMetrics(page); assert.equal(after.mode, 'flow'); assert.equal(after.readButton.disabled, false); await snapshot(page, 'fit-fallback-button'); return { before, after }; }));
await check('OS reduced motion takes precedence over saved false and explicit normal query', () => isolated({ reducedMotion: 'reduce' }, async (page, context) => { const state = await readState(page); assert.equal(state.reduced, 'true'); assert.equal(state.mode, 'flow'); assert.equal(await page.locator('#reduce-motion').isChecked(), false); assert.equal(await page.locator('#read-mode').isDisabled(), true); await snapshot(page, 'os-reduced'); return { state, reviewCheckbox: false, animations: await page.evaluate(() => document.getAnimations().length), cookies: await context.cookies() }; }, { suffix: '?motion=normal&view=deck', init: () => { document.cookie = 'lynn_review_settings=' + encodeURIComponent(JSON.stringify({ version: 2, preset: 'balanced', desktop: 'staggered', view: 'deck', reduce: false, debug: false, panelOpen: false, tuning: {} })) + '; Path=/; SameSite=Lax'; } }));
await check('JavaScript-disabled document fallback', () => isolated({ javaScriptEnabled: false }, async page => { assert.equal(await page.locator('body').getAttribute('data-mode'), 'flow'); assert.equal(await page.locator('.card').count(), 6); assert.equal(await page.locator('#open-contact').isDisabled(), true); assert.equal(await page.locator('#contact-fields').evaluate(el => el.disabled), true); await snapshot(page, 'no-js', true); return { visibleCards: await page.locator('.card').evaluateAll(cards => cards.filter(card => card.getBoundingClientRect().height > 0).length) }; }));
await check('desktop staggered entrance timing', () => isolated({ viewport: { width: 1280, height: 900 } }, async page => { const entrances = await page.evaluate(() => window.__qaEntrances); const entrance = entrances.find(e => e.options.delay === 80); assert.ok(entrance); assert.equal(entrance.options.duration, 380); await snapshot(page, 'desktop-entrance'); return entrances; }, { wait: 50 }));

async function point(page) { return page.locator('.card[data-active]').evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width * .5, y: r.top + r.height * .55 }; }); }
for (const cadence of [150, 350, 600, 1200]) for (const direction of [1, -1]) for (const strategy of ['stationary', 'move']) {
  await check(`wheel ${direction > 0 ? 'forward' : 'reverse'} ${cadence}ms ${strategy}`, () => isolated({}, async page => {
    assert.equal((await readState(page)).mode, 'deck'); let cursor = await point(page); await page.mouse.move(cursor.x, cursor.y);
    const before = await readState(page);
    for (let pulse = 0; pulse < 3; pulse++) {
      if (pulse) await page.waitForTimeout(cadence);
      if (strategy === 'move' && pulse) { const active = await page.locator('.card[data-active]').count(); if (active) cursor = await point(page); await page.mouse.move(cursor.x + (pulse % 2 ? 2 : -2), cursor.y); }
      await page.mouse.wheel(0, direction * 40);
    }
    await page.waitForTimeout(1050);
    const detail = { method: 'Trusted Playwright mouse.wheel, artificial cadence; not hardware momentum.', before, after: await readState(page), inputs: await page.evaluate(() => window.__qaInputs), requests: await page.evaluate(() => window.__qaRequests) };
    assert.equal(detail.inputs.length, 3); assert.ok(detail.inputs.every(input => input.trusted));
    await snapshot(page, `wheel-${direction}-${cadence}-${strategy}`); return detail;
  }, { suffix: '#how-it-works', wait: 350 }));
}
await check('resize during accepted wheel transition settles the existing position', () => isolated({}, async page => {
  assert.equal((await readState(page)).mode, 'deck');
  const cursor = await point(page); await page.mouse.move(cursor.x, cursor.y);
  await page.mouse.wheel(0, 40); await page.waitForTimeout(125);
  const beforeResize = await readState(page);
  assert.equal(beforeResize.requested, 1); assert.equal(beforeResize.state, 'settling');
  await snapshot(page, 'resize-during-before');
  await page.setViewportSize({ width: 390, height: 845 }); await page.waitForTimeout(100);
  const afterResize = await readState(page);
  await snapshot(page, 'resize-during-after');
  assert.equal(afterResize.mode, 'deck'); assert.equal(afterResize.state, 'idle');
  assert.equal(afterResize.requested, 0); assert.equal(afterResize.position, 0);
  return { method: 'Trusted Playwright wheel followed by browser viewport resize; does not establish native Safari toolbar behavior.', initialViewport: { width: 390, height: 844 }, resizedViewport: { width: 390, height: 845 }, beforeResize, afterResize, inputs: await page.evaluate(() => window.__qaInputs), requests: await page.evaluate(() => window.__qaRequests) };
}, { wait: 350 }));
await check('artificial 100ms momentum tail', () => isolated({}, async page => { const cursor = await point(page); await page.mouse.move(cursor.x, cursor.y); await page.mouse.wheel(0, 40); for (let n = 0; n < 20; n++) { await page.waitForTimeout(100); await page.mouse.wheel(0, 8); } await page.waitForTimeout(500); const afterTail = await readState(page); assert.equal(afterTail.requested, 1); const cursor2 = await point(page); await page.mouse.move(cursor2.x + 2, cursor2.y); await page.mouse.wheel(0, 40); await page.waitForTimeout(1000); assert.equal((await readState(page)).requested, 2); return { method: 'Artificial timed tail, not native device momentum.', afterTail, afterQuietAndNewStroke: await readState(page), inputs: await page.evaluate(() => window.__qaInputs), requests: await page.evaluate(() => window.__qaRequests) }; }, { wait: 350 }));
await check('browser and asset faults', async () => { assert.deepEqual(faults, []); return { faults: faults.length }; });
let revision = null;
try { const context = await browser.newContext(); const page = await context.newPage(); const response = await page.goto(new URL('revision.json', baseURL).href); revision = JSON.parse(await response.text()); await context.close(); } catch (error) { revision = { unavailable: error.message }; }
const report = { checkedAt: new Date().toISOString(), baseURL, browser: browserName, browserVersion: browser.version(), checkFilter: process.env.QA_CHECK_FILTER || null, revision, evidenceScope: 'Chromium-family browser automation and isolated DOM observation only. Native Safari, iOS Safari, Firefox, hardware trackpad momentum, native scrolling/toolbar behavior are unverified.', results, faults };
await writeFile(path.join(output, `${browserName}-safari-investigation.json`), JSON.stringify(report, null, 2) + '\n');
await browser.close();
console.log(JSON.stringify({ pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length, output }));
if (results.some(r => r.status === 'FAIL')) process.exitCode = 1;




