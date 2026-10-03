import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const baseURL=process.env.BASE_URL||'http://127.0.0.1:4189';
const output=path.resolve(process.env.EVIDENCE_DIR||'verification/hint/local');
const modulePath=process.env.PW_MODULE||'C:/Users/pgche/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(pathToFileURL(modulePath).href);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Users/pgche/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'});
const results=[],faults=[]; await mkdir(output,{recursive:true});
async function check(name,operation){try{const detail=await operation();results.push({name,status:'PASS',detail});console.log('PASS '+name+': '+JSON.stringify(detail));}catch(error){results.push({name,status:'FAIL',message:error.message,stack:error.stack});console.error('FAIL '+name+': '+error.message);}}
async function isolated(options,operation,suffix=''){
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,...options});const page=await context.newPage();page.setDefaultTimeout(10000);
 page.on('pageerror',error=>faults.push(error.message));page.on('console',msg=>{if(msg.type()==='error')faults.push(msg.text());});page.on('requestfailed',request=>faults.push(request.url()+': '+request.failure()?.errorText));page.on('response',response=>{if(response.status()>=400)faults.push(response.url()+': '+response.status());});
 await page.addInitScript(()=>{
  window.__hintTimers=[];const nativeTimeout=window.setTimeout;
  window.setTimeout=function(callback,delay,...args){if(delay!==5000)return nativeTimeout.call(this,callback,delay,...args);const timer={scheduled:performance.now()};window.__hintTimers.push(timer);return nativeTimeout.call(this,(...values)=>{timer.fired=performance.now();return callback(...values);},delay,...args);};
 });
 try{await page.goto(baseURL+suffix);return await operation(page,context);}finally{await context.close();}
}
async function cue(page){return page.locator('#experimental-swipe-cue').evaluate(el=>({visible:el.dataset.visible,opacity:Number(getComputedStyle(el).opacity),visibility:getComputedStyle(el).visibility,display:getComputedStyle(el).display,pointerEvents:getComputedStyle(el).pointerEvents,ariaHidden:el.getAttribute('aria-hidden'),tabIndex:el.tabIndex,focus:document.activeElement.id||document.activeElement.tagName}));}
async function elapsed(page,ms){await page.waitForFunction(ms=>window.__hintTimers.length&&performance.now()>=window.__hintTimers.at(-1).scheduled+ms,ms,{timeout:ms+2000});}
async function hidden(page){const value=await cue(page);assert.ok(value.visible!=='true');assert.equal(value.opacity,0);return value;}
async function visible(page){const value=await cue(page);assert.equal(value.visible,'true');assert.equal(value.visibility,'visible');assert.ok(Math.abs(value.opacity-.45)<.005);return value;}
async function geometry(page){return page.evaluate(()=>['#deck-stage','#top','.deck-controls','#next-card','#previous-card','#read-mode'].map(selector=>({selector,rect:document.querySelector(selector).getBoundingClientRect().toJSON()})));}
const jobs=[];
for(const[width,height,hasTouch]of[[390,844,true],[800,900,false]])jobs.push(()=>check('idle first card waits five seconds, stays decorative and does not shift geometry '+width,()=>isolated({viewport:{width,height},hasTouch},async page=>{
 await page.waitForTimeout(350);const before=await geometry(page);const focus=(await cue(page)).focus;await hidden(page);
 if(width===390)await page.screenshot({path:path.join(output,'hint-before-390.png')});
 await elapsed(page,4500);await hidden(page);await elapsed(page,5350);const shown=await visible(page);
 assert.deepEqual(await geometry(page),before);assert.equal(shown.focus,focus);assert.equal(shown.ariaHidden,'true');assert.equal(shown.pointerEvents,'none');assert.equal(shown.tabIndex,-1);
 assert.equal(await page.locator('#experimental-swipe-cue a,#experimental-swipe-cue button,#experimental-swipe-cue input,#experimental-swipe-cue [tabindex]').count(),0);
 assert.equal(await page.locator('#experimental-swipe-cue').evaluate(el=>{const r=el.getBoundingClientRect();return Boolean(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#experimental-swipe-cue'));}),false);
 assert.match(await page.locator('#gesture-hint .sr-only').textContent(),/use the arrows/);
 await page.screenshot({path:path.join(output,'hint-visible-'+width+'.png')});
 const animation=await page.locator('#experimental-swipe-cue svg').evaluate(el=>({duration:getComputedStyle(el).animationDuration,iterations:getComputedStyle(el).animationIterationCount,timing:el.getAnimations()[0]?.effect.getTiming()}));
 assert.equal(animation.duration,'1.2s');assert.equal(animation.iterations,'2');assert.equal(animation.timing.duration,1200);assert.equal(animation.timing.iterations,2);
 await page.waitForTimeout(2400);assert.equal(await page.locator('#experimental-swipe-cue svg').evaluate(el=>el.getAnimations().filter(a=>a.playState==='running').length),0);await visible(page);
 return{width,height,hasTouch,timer:await page.evaluate(()=>window.__hintTimers[0]),shown,animation,geometryUnchanged:true,method:'Actual browser timer and CSS animation; physical/native browser coverage remains unverified'};
})));
for(const input of ['wheel','pointer','keyboard'])jobs.push(()=>check('any '+input+' dismisses cue until reload',()=>isolated({hasTouch:false},async page=>{
 await elapsed(page,5350);await visible(page);
 await page.evaluate(()=>{window.__hintInput=[];for(const type of ['wheel','pointerdown','keydown'])document.addEventListener(type,e=>window.__hintInput.push({type,trusted:e.isTrusted}),{capture:true,passive:true});});
 if(input==='wheel'){await page.mouse.move(20,20);await page.mouse.wheel(0,1);}if(input==='pointer')await page.mouse.click(20,20);if(input==='keyboard')await page.keyboard.press('Shift');
 await page.waitForTimeout(400);await hidden(page);await page.waitForTimeout(5300);await hidden(page);
 const events=await page.evaluate(()=>window.__hintInput);assert.ok(events.some(e=>e.trusted));await page.reload();await elapsed(page,5350);await visible(page);
 return{input,events,method:'Playwright browser input, actual elapsed wait, then reload'};
})));
jobs.push(()=>check('hidden tab resets the countdown before cue can reappear',()=>isolated({},async page=>{
 await elapsed(page,3000);await page.evaluate(()=>{window.__syntheticHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__syntheticHidden});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(3000);await hidden(page);await page.evaluate(()=>{window.__syntheticHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
 await elapsed(page,4500);await hidden(page);await elapsed(page,5350);await visible(page);
 const timers=await page.evaluate(()=>window.__hintTimers);assert.equal(timers.length,2);assert.ok(timers[1].scheduled-timers[0].scheduled>=5500);
 return{timers,method:'Synthetic document.hidden accessor and visibilitychange notifications; actual five-second timers. OS tab/background throttling remains unverified.'};
})));
for(const variant of ['desktop','reading','reduced','dialog','later-hash'])jobs.push(()=>check('cue stays suppressed for '+variant,()=>isolated(variant==='desktop'?{viewport:{width:1280,height:900},hasTouch:false}:variant==='reduced'?{reducedMotion:'reduce'}:{},async page=>{
 if(variant==='reading')await page.locator('#read-mode').click();if(variant==='dialog')await page.locator('#contact-dialog').evaluate(el=>el.showModal());
 await page.waitForTimeout(5550);await hidden(page);
 if(variant==='later-hash'){await page.evaluate(()=>location.hash='top');await page.waitForTimeout(5550);await hidden(page);}
 return{variant,mode:await page.locator('body').getAttribute('data-mode'),dialogOpen:await page.locator('#contact-dialog').evaluate(el=>el.open),method:variant==='dialog'?'Programmatic native dialog.showModal verifies the open-dialog guard independently of input dismissal':'Browser viewport/media/input/hash state and actual wait'};
},variant==='later-hash'?'#services':'')));
// Bound independent contexts to three workers; every check owns its context.
let next=0;await Promise.all(Array.from({length:3},async()=>{while(next<jobs.length)await jobs[next++]();}));
await check('no browser or asset errors',async()=>{assert.deepEqual(faults,[]);return{faults:0};});
let revision=null;try{revision=await(await fetch(new URL('revision.json',baseURL))).json();}catch(error){faults.push(error.message);}
const report={checkedAt:new Date().toISOString(),baseURL,revision,engine:'Chromium '+browser.version(),results,faults,notes:['Chromium browser input and CSS/timer checks only. Native Safari, Firefox, Edge, physical trackpads/touchscreens, and real hidden-tab throttling remain unverified by this suite.','Existing browser regressions are reported separately in browser-results.json.']};
await browser.close();await writeFile(path.join(output,'hint-results.json'),JSON.stringify(report,null,2)+'\n');await writeFile(path.join(output,'hint-results.md'),'# Experimental hint checks\n\n'+results.map(r=>'- '+r.status+': '+r.name+(r.message?' — '+r.message:'')).join('\n')+'\n');console.log('Evidence: '+output);if(results.some(r=>r.status==='FAIL')||faults.length)process.exitCode=1;
