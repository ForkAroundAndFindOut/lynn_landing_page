import assert from 'node:assert/strict';
import {mkdir, unlink, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const baseURL=process.env.BASE_URL||'http://127.0.0.1:4191';
const output=path.resolve(process.env.EVIDENCE_DIR||'verification/tuning/recordings');
const {chromium}=await import(pathToFileURL(process.env.PW_MODULE||'C:/Users/pgche/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Users/pgche/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'});
await mkdir(output,{recursive:true});
const reports=[];
const settled=(page,value)=>page.waitForFunction(value=>{const s=document.querySelector('#deck-stage');return s.dataset.deckState==='idle'&&Number(s.dataset.deckPosition)===value;},value,{timeout:8000});
for(const name of ['text-command-and-retarget','text-flick','contact-expansion']) {
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,recordVideo:{dir:output,size:{width:390,height:844}}});
 const page=await context.newPage(),faults=[];page.on('pageerror',e=>faults.push(e.message));
 await page.goto(baseURL+(name==='contact-expansion'?'#contact':''));await page.waitForTimeout(650);
 if(name==='contact-expansion') {
  await page.locator('#open-contact').click();await page.waitForTimeout(800);
  assert.equal(await page.locator('#contact-dialog').getAttribute('data-phase'),'open');
  await page.locator('#close-contact').click();await page.waitForTimeout(600);
 } else {
  const session=await context.newCDPSession(page);
  const start=await page.locator('#hero-title').boundingBox();
  const x=start.x+24,y=start.y+start.height/2;
  const touch=(type,travel=0)=>session.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{id:1,x,y:y-travel}]});
  await touch('touchStart');await touch('touchMove',12);await page.waitForTimeout(8);await touch('touchMove',name==='text-flick'?24:64);await touch('touchEnd');
  if(name==='text-command-and-retarget') {
   await page.waitForTimeout(400);
   await touch('touchStart');await touch('touchMove',64);await touch('touchEnd');await settled(page,2);
   await page.waitForTimeout(400);await page.locator('#previous-card').click();await settled(page,1);
  } else await settled(page,1);
  await session.detach();await page.waitForTimeout(600);
 }
 assert.deepEqual(faults,[]);
 const video=page.video(),raw=await video.path();await context.close();const dest=path.join(output,name+'.webm');await video.saveAs(dest);if(raw!==dest&&path.resolve(raw).startsWith(output+path.sep))await unlink(raw);
 reports.push({name,file:name+'.webm',status:'PASS',method:'Chromium trusted touch/button input; browser video, not physical-device recording'});
}
const revision=await (await fetch(new URL('revision.json',baseURL))).json();
await browser.close();await writeFile(path.join(output,'recordings.json'),JSON.stringify({baseURL,revision,checkedAt:new Date().toISOString(),reports},null,2)+'\n');console.log(JSON.stringify(reports));
