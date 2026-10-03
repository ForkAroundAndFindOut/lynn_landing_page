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
async function check(name,operation){if(process.env.CHECK_FILTER&&!new RegExp(process.env.CHECK_FILTER).test(name))return;try{const detail=await operation();results.push({name,status:'PASS',detail});console.log('PASS '+name+': '+JSON.stringify(detail));}catch(error){results.push({name,status:'FAIL',message:error.message,stack:error.stack});console.error('FAIL '+name+': '+error.message);}}
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
async function settled(page,position){await page.waitForFunction(value=>{const stage=document.querySelector('#deck-stage');return stage.dataset.deckState==='idle'&&Math.abs(Number(stage.dataset.deckPosition)-value)<.001;},position,{timeout:5000});}
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
for(const[width,height]of[[360,740],[412,915]])jobs.push(()=>check('Android Chrome emulation shows the reminder at '+width+'x'+height,()=>isolated({viewport:{width,height},hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36'},async page=>{
 await elapsed(page,5350);const shown=await visible(page);
 assert.equal(await page.locator('body').getAttribute('data-mode'),'deck');
 const bounds=await page.locator('#experimental-swipe-cue').evaluate(el=>({cue:el.getBoundingClientRect().toJSON(),viewport:{top:visualViewport.offsetTop,height:visualViewport.height,width:visualViewport.width}}));
 assert.ok(bounds.cue.top>=bounds.viewport.top&&bounds.cue.bottom+2<=bounds.viewport.top+bounds.viewport.height,'cue and arrow nudge fit in the visible mobile viewport');
 assert.ok(bounds.cue.left>=0&&bounds.cue.right<=bounds.viewport.width,'cue fits horizontally');
 await page.screenshot({path:path.join(output,'hint-android-'+width+'.png')});
 return{width,height,mode:'deck',shown,bounds,method:'Chromium Android user-agent/mobile viewport emulation and rendered viewport bounds; not a physical Android device'};
})));
for(const input of ['wheel','pointer','keyboard'])jobs.push(()=>check(input+' activity restarts the idle reminder',()=>isolated({hasTouch:false},async page=>{
 await elapsed(page,2000);
 await page.evaluate(()=>{window.__hintInput=[];for(const type of ['wheel','pointerdown','keydown'])document.addEventListener(type,e=>window.__hintInput.push({type,trusted:e.isTrusted}),{capture:true,passive:true});});
 if(input==='wheel'){await page.mouse.move(20,20);await page.mouse.wheel(0,1);}if(input==='pointer')await page.mouse.click(20,20);if(input==='keyboard')await page.keyboard.press('Shift');
 await page.waitForTimeout(400);await hidden(page);await elapsed(page,4500);await hidden(page);await elapsed(page,5350);await visible(page);
 const events=await page.evaluate(()=>window.__hintInput);assert.ok(events.some(e=>e.trusted));
 return{input,events,timers:await page.evaluate(()=>window.__hintTimers),method:'Playwright browser input before first cue, actual five-second quiet wait'};
})));
jobs.push(()=>check('returning to the first card starts a fresh idle reminder',()=>isolated({hasTouch:false},async page=>{
 await page.locator('#next-card').click();await settled(page,1);await hidden(page);
 await page.locator('#go-top').click();await settled(page,0);await hidden(page);
 await elapsed(page,5350);await visible(page);
 return{position:await page.locator('#deck-stage').getAttribute('data-deck-position'),timers:await page.evaluate(()=>window.__hintTimers),method:'Card navigation in Chromium, followed by actual five-second idle wait'};
})));
jobs.push(()=>check('an open review panel pauses the reminder and closing it restarts the interval',()=>isolated({},async page=>{
 await page.locator('#review-settings').evaluate(el=>{el.open=true;});await page.waitForTimeout(5350);await hidden(page);
 await page.locator('#review-settings').evaluate(el=>{el.open=false;});await elapsed(page,5350);await visible(page);
 return{panelOpen:await page.locator('#review-settings').evaluate(el=>el.open),timers:await page.evaluate(()=>window.__hintTimers),method:'Open and close the saved review panel state in Chromium'};
})));
jobs.push(()=>check('a held pointer suppresses the reminder until release',()=>isolated({},async page=>{
 await elapsed(page,1000);await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointerdown',{pointerId:42,bubbles:true})));
 await page.waitForTimeout(5350);await hidden(page);
 await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointerup',{pointerId:42,bubbles:true})));
 await elapsed(page,5350);await visible(page);
 return{timers:await page.evaluate(()=>window.__hintTimers),method:'Synthetic held pointer with real timers; release starts the idle interval'};
})));
jobs.push(()=>check('selected text pauses the reminder until selection clears',()=>isolated({},async page=>{
 await elapsed(page,1000);await page.locator('#hero-title').evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);getSelection().addRange(range);});
 await page.waitForTimeout(5350);await hidden(page);
 await page.evaluate(()=>getSelection().removeAllRanges());await elapsed(page,5350);await visible(page);
 return{selectedText:await page.evaluate(()=>getSelection().toString()),timers:await page.evaluate(()=>window.__hintTimers),method:'Browser text selection change with real timers'};
})));
jobs.push(()=>check('window blur clears a lost pointer and focus starts a new interval',()=>isolated({},async page=>{
 await elapsed(page,1000);await page.evaluate(()=>{document.dispatchEvent(new PointerEvent('pointerdown',{pointerId:77,bubbles:true}));window.__syntheticFocus=false;Object.defineProperty(document,'hasFocus',{configurable:true,value:()=>window.__syntheticFocus});window.dispatchEvent(new Event('blur'));});
 await page.waitForTimeout(5350);await hidden(page);
 await page.evaluate(()=>{window.__syntheticFocus=true;window.dispatchEvent(new Event('focus'));});await elapsed(page,5350);await visible(page);
 return{timers:await page.evaluate(()=>window.__hintTimers),method:'Synthetic hasFocus state and blur/focus events, with actual timers'};
})));
jobs.push(()=>check('hidden tab resets the countdown before cue can reappear',()=>isolated({},async page=>{
 await elapsed(page,3000);await page.evaluate(()=>{window.__syntheticHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__syntheticHidden});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(3000);await hidden(page);await page.evaluate(()=>{window.__syntheticHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
 await elapsed(page,4500);await hidden(page);await elapsed(page,5350);await visible(page);
 const timers=await page.evaluate(()=>window.__hintTimers);assert.equal(timers.length,2);assert.ok(timers[1].scheduled-timers[0].scheduled>=5500);
 return{timers,method:'Synthetic document.hidden accessor and visibilitychange notifications; actual five-second timers. OS tab/background throttling remains unverified.'};
})));
for(const variant of ['desktop','reading','reduced','dialog','later-hash'])jobs.push(()=>check(variant==='later-hash'?'deep link stays suppressed until first card is revisited':'cue stays suppressed for '+variant,()=>isolated(variant==='desktop'?{viewport:{width:1280,height:900},hasTouch:false}:variant==='reduced'?{reducedMotion:'reduce'}:{},async page=>{
 if(variant==='reading')await page.locator('#read-mode').click();if(variant==='dialog')await page.locator('#contact-dialog').evaluate(el=>el.showModal());
 await page.waitForTimeout(5550);await hidden(page);
 if(variant==='later-hash'){await page.evaluate(()=>location.hash='top');await elapsed(page,5350);await visible(page);}
 return{variant,mode:await page.locator('body').getAttribute('data-mode'),dialogOpen:await page.locator('#contact-dialog').evaluate(el=>el.open),method:variant==='dialog'?'Programmatic native dialog.showModal verifies the open-dialog guard independently of input dismissal':'Browser viewport/media/input/hash state and actual wait'};
},variant==='later-hash'?'#services':'')));
// Bound independent contexts to three workers; every check owns its context.
let next=0;await Promise.all(Array.from({length:3},async()=>{while(next<jobs.length)await jobs[next++]();}));
await check('no browser or asset errors',async()=>{assert.deepEqual(faults,[]);return{faults:0};});
let revision=null;try{revision=await(await fetch(new URL('revision.json',baseURL))).json();}catch{}
const report={checkedAt:new Date().toISOString(),baseURL,revision,engine:'Chromium '+browser.version(),results,faults,notes:['Chromium browser input and CSS/timer checks only. Native Safari, Firefox, Edge, physical trackpads/touchscreens, and real hidden-tab throttling remain unverified by this suite.','Existing browser regressions are reported separately in browser-results.json.',...(revision?[]:['Revision metadata is unavailable when serving the source tree directly.'])]};
await browser.close();await writeFile(path.join(output,'hint-results.json'),JSON.stringify(report,null,2)+'\n');await writeFile(path.join(output,'hint-results.md'),'# Experimental hint checks\n\n'+results.map(r=>'- '+r.status+': '+r.name+(r.message?' — '+r.message:'')).join('\n')+'\n');console.log('Evidence: '+output);if(results.some(r=>r.status==='FAIL')||faults.length)process.exitCode=1;
