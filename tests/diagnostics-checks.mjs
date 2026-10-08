import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE || 'C:/Users/pgche/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const base = process.env.BASE_URL || 'http://127.0.0.1:4193';
const output = process.env.EVIDENCE_DIR || 'verification/safari-qa/diagnostics-local';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:/Users/pgche/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe' });
const results = [];
async function check(name, fn, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...options });
  const page = await context.newPage(), faults = [];
  page.on('pageerror', error => faults.push(error.message));
  page.setDefaultTimeout(7000);
  try { const detail = await fn(page, context); results.push({ name, status: 'PASS', detail, faults }); console.log('PASS ' + name); }
  catch(error) { results.push({ name, status: 'FAIL', error: error.message, faults }); console.error('FAIL ' + name + ': ' + error.message); }
  finally { await context.close(); }
}
async function ready(page, suffix = '?qa=1') { await page.goto(base + '/' + suffix); await page.waitForFunction(() => window.__cardQA && window.__cardQA.report().counts['app-ready']); await page.waitForTimeout(250); }
const snapshot = page => page.evaluate(() => window.__cardQA.snapshot());
const report = page => page.evaluate(() => window.__cardQA.report());
const target = page => page.locator('#position').innerText().then(text => Number(text.trim().slice(0,2))-1);
async function point(page) { const box=await page.locator('#deck-stage').boundingBox();return{x:box.x+box.width/2,y:box.y+box.height*.6}; }
await check('logging is absent by default', async page => { await page.goto(base); await page.locator('#review-settings:not([hidden])').waitFor(); assert.equal(await page.evaluate(() => Boolean(window.__cardQA)), false);assert.equal(await page.locator('#qa-session').count(),0);return{mode:await page.locator('body').getAttribute('data-mode')}; });
await check('opt-in session captures initial geometry and final trusted wheel results', async page => {
  await ready(page); const initial=await snapshot(page);assert.equal(initial.mode,'deck');assert.equal(initial.layoutDecision.geometry.cards.length,6);assert.equal(initial.reducedOS,false);
  const p=await point(page);await page.mouse.move(p.x,p.y);await page.mouse.wheel(0,80);await page.waitForTimeout(40);
  let r=await report(page);const input=r.events.find(e=>e.type==='input/wheel'),out=r.events.find(e=>e.type==='result/wheel'&&e.inputId===input.inputId);
  assert.equal(input.trusted,true);assert.equal(out.prevented,true);assert.equal(out.requestedIndex,1);assert.ok(r.events.some(e=>e.type==='deck/request'&&e.accepted));
  await page.waitForTimeout(600);await page.mouse.wheel(0,80);await page.waitForTimeout(40);assert.equal(await target(page),2);
  await page.screenshot({path:path.join(output,'session-closed.png')});await page.locator('#qa-session summary').click();await page.screenshot({path:path.join(output,'session-open.png')});
  return{initial,report:await report(page)};
});
await check('OS reduction and a false review override are shown separately', async page => {
  await ready(page);await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(150);const s=await snapshot(page);
  assert.equal(s.reducedOS,true);assert.equal(s.reducedReview,false);assert.equal(s.reducedEffective,true);assert.equal(s.mode,'flow');assert.equal(s.cardButtonDisabled,true);return s;
});
await check('content-fit fallback reports candidate measurements and leaves card button enabled', async page=>{
  await ready(page);const s=await snapshot(page);assert.equal(s.mode,'flow');assert.equal(s.cardButtonDisabled,false);assert.ok(s.layoutDecision.geometry.neededHeight>s.layoutDecision.geometry.limit);return s;
},{viewport:{width:390,height:667}});
await check('session logging excludes contact values and selected text', async page=>{
  await ready(page);await page.locator('#deck-stage').focus();await page.keyboard.press('End');await page.waitForTimeout(250);await page.locator('#open-contact').click();await page.locator('#message').waitFor();
  await page.locator('#name').fill('PRIVATE_NAME_CANARY');await page.locator('#email').fill('private_email_canary@example.test');await page.locator('#message').fill('PRIVATE_MESSAGE_CANARY');
  const data=JSON.stringify(await report(page));assert.ok(!data.includes('PRIVATE_NAME_CANARY'));assert.ok(!data.includes('private_email_canary'));assert.ok(!data.includes('PRIVATE_MESSAGE_CANARY'));return{contactValuesAbsent:true};
});
await check('bounded session supports pause and resume', async page=>{
  await ready(page);await page.evaluate(()=>{for(let i=0;i<1250;i++)window.__cardQA.record('probe',{index:i});});let r=await report(page);assert.equal(r.events.length,1200);assert.ok(r.dropped>0);
  await page.locator('#qa-session summary').click();await page.getByRole('button',{name:'Pause logging',exact:true}).click();const count=(await report(page)).events.length;
  await page.evaluate(()=>window.__cardQA.record('paused-probe'));assert.equal((await report(page)).events.length,count);assert.equal((await report(page)).logging,false);
  await page.getByRole('button',{name:'Resume logging',exact:true}).click();await page.evaluate(()=>window.__cardQA.record('resumed-probe'));assert.ok((await report(page)).events.some(e=>e.type==='resumed-probe'));return{limit:r.limit,dropped:r.dropped};
});
await check('clipboard fallback provides a readable report without developer tools', async page=>{
  await ready(page);await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('Test denied clipboard'))}}));
  await page.locator('#qa-session summary').click();await page.getByRole('button',{name:'Copy diagnostic report'}).click();const field=page.getByRole('textbox',{name:'Diagnostic report'});await field.waitFor();const r=JSON.parse(await field.inputValue());assert.equal(r.snapshot.mode,'deck');return{fallback:true};
});
await check('early module failure remains visible in the diagnostic session', async page=>{
  await page.route('**/deck-controller.js',route=>route.fulfill({contentType:'text/javascript',body:'throw new Error("QA_STARTUP_FAILURE"); export function createDeck() {}'}));
  await page.goto(base+'/?qa=1');await page.locator('#qa-session').waitFor({state:'attached'});await page.waitForTimeout(200);const r=await report(page);assert.ok(r.events.some(e=>e.type==='error'&&e.message.includes('QA_STARTUP_FAILURE')));assert.equal(r.counts['app-ready'],undefined);return{expectedErrorCaptured:true};
});

await check('paused layout stays current and tuning changes/reset are associated with requests', async page=>{
  await ready(page);const initial=await report(page);assert.ok(initial.events.find(e=>e.type==='app-ready').tuning);
  await page.locator('#review-settings').evaluate(el=>el.open=true);await page.locator('#tuning-duration').fill('1.3');await page.locator('#tuning-duration').press('Tab');await page.locator('#reset-tuning').click();
  let r=await report(page);assert.ok(r.events.some(e=>e.type==='settings'&&e.tuning?.duration===1.3));assert.ok(r.events.some(e=>e.type==='settings'&&e.tuning?.duration===.9));
  await page.locator('#review-settings').evaluate(el=>el.open=false);
  const p=await point(page);await page.mouse.move(p.x,p.y);await page.mouse.wheel(0,80);await page.waitForTimeout(30);r=await report(page);assert.equal(r.events.find(e=>e.type==='deck/request'&&e.accepted).tuning.duration,.9);
  await page.locator('#qa-session summary').click();await page.getByRole('button',{name:'Pause logging',exact:true}).click();await page.setViewportSize({width:390,height:915});await page.waitForTimeout(120);
  const s=await snapshot(page);assert.equal(s.viewport.visualHeight,915);assert.equal(s.layoutDecision.viewportHeight,915);return{pausedSnapshotCurrent:true,settingsHistory:true};
});
await check('collapsed diagnostics leave mobile navigation controls unobstructed', async page=>{
  await ready(page);for(const id of ['go-top','previous-card','next-card','read-mode']){
    const clear=await page.locator('#'+id).evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});assert.equal(clear,true,id);
  }return{navigationAccessible:true};
});

await browser.close();
const counts={pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length,total:results.length};
await writeFile(path.join(output,'results.json'),JSON.stringify({checkedAt:new Date().toISOString(),base,counts,results,coverage:'Chromium automation; physical Safari remains unverified.'},null,2)+'\n');
console.log(JSON.stringify(counts));if(counts.fail)process.exitCode=1;
