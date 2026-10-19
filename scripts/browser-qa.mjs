import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {makeLevel, projection, value} from '../.build/engine.js';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QA_URL || 'http://127.0.0.1:5191/';
const profile = await mkdtemp(join(tmpdir(),'tangent-qa-'));
const errors=[], report=[];
await mkdir('test-results',{recursive:true});
const context = await chromium.launchPersistentContext(profile,{headless:true,...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}),viewport:{width:320,height:568},hasTouch:true,deviceScaleFactor:2});
// Keep headless native install dialogs from interfering with the fallback-guide test.
await context.addInitScript(()=>window.addEventListener('beforeinstallprompt',event=>{if(event.isTrusted)event.stopImmediatePropagation();},{capture:true}));
const page = await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.goto(base);
await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
await page.reload();
async function geometry(label) {
  const result=await page.evaluate(()=>{
    const selectors=['.topbar','.worlds','.level-heading','#levels','.mission','.arena','#board','.control-bar','#feedback','#install','#hint','#retry',...Array.from({length:12},(_,i)=>`[data-level]:nth-child(${i+1})`)];
    if(!document.querySelector('#direction-control').hidden)selectors.push('#direction-control');
    if(!document.querySelector('#timer').hidden)selectors.push('#timer');
    if(!document.querySelector('#result').hidden)selectors.push('#result-next','#result-replay');
    return{w:innerWidth,h:innerHeight,scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight,boxes:selectors.filter(s=>document.querySelector(s).getBoundingClientRect().height>0).map(s=>{const r=document.querySelector(s).getBoundingClientRect();return{s,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};})};
  });
  assert.ok(result.scrollW<=result.w+1,`${label}: horizontal overflow`);assert.ok(result.scrollH<=result.h+1,`${label}: vertical overflow`);
  for(const b of result.boxes)assert.ok(b.x>=-.5&&b.y>=-.5&&b.right<=result.w+.5&&b.bottom<=result.h+.5&&b.h>0,`${label}: clipped ${JSON.stringify(b)}`);
  const arena=result.boxes.find(b=>b.s==='#board');assert.ok(arena.h>=100,`${label}: plot too short`);
  return {label,viewport:`${result.w}×${result.h}`,board:`${Math.round(arena.w)}×${Math.round(arena.h)}`,fits:true};
}
async function unlock() {
  await page.evaluate(()=>{const save=JSON.parse(localStorage.getItem('tangent-strike-v1'));save.stars=Array(60).fill(1);localStorage.setItem('tangent-strike-v1',JSON.stringify(save));});
  await page.reload();
}
async function select(id) {
  await page.locator(`[data-world="${Math.floor(id/12)}"]`).click();
  if(await page.locator('#levels').isVisible())await page.locator(`button[data-level="${id}"]`).click();
  else{await page.locator('#help').click();await page.locator('#menu-levels').click();await page.locator(`[data-jump="${id}"]`).click();}
}
async function shootAt(id, a = makeLevel(id).solution) {
  const level=makeLevel(id);
  if(level.rule==='choose')await page.locator(`[data-direction="${level.solutionDirection}"]`).click();
  const rect=await page.locator('#board').boundingBox(), camera=projection(level,rect.width,rect.height);
  const p={x:rect.x+camera.center.x+a*camera.scale,y:rect.y+camera.center.y-value(level.curve,a)*camera.scale};
  await page.touchscreen.tap(p.x,p.y);
  await page.locator('#result:not([hidden])').waitFor({timeout:4000});
}
async function solve(id) {
  await shootAt(id);
  assert.match(await page.locator('#result h3').innerText(),/Plein centre|Tir précis|Dérivée suprême/);
}
try{
  // Real UI: first touch, star award and persistent reload.
  report.push(await geometry('first level'));
  await page.screenshot({path:'test-results/phone-320x568.png'});
  await solve(0);assert.match(await page.locator('#result .stars').getAttribute('aria-label'),/3/);
  report.push(await geometry('first win'));await page.screenshot({path:'test-results/phone-result.png'});
  await page.reload();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tangent-strike-v1')).stars[0]),3);
  // Menu features remain reachable even when the sidebar is hidden.
  await page.locator('#help').click();await page.locator('#menu-practice').click();await page.locator('[data-practice="4"]').click();
  assert.equal(await page.locator('#mode-badge').innerText(),'LABORATOIRE');
  await page.locator('#help').click();await page.locator('#menu-practice').click();
  await page.locator('#install').click();assert.match(await page.locator('#modal-content').innerText(),/Installer|installation|Installer/);await page.locator('#close-modal').click();
  await page.evaluate(()=>{const event=new Event('beforeinstallprompt');event.prompt=()=>Promise.resolve();event.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(event);});
  await page.locator('#install').click();await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Installation acceptée'));
  await unlock();
  for(const viewport of [{width:320,height:480},{width:320,height:568},{width:360,height:640},{width:375,height:667},{width:390,height:844},{width:430,height:932},{width:568,height:320},{width:844,height:390},{width:768,height:1024},{width:1024,height:768},{width:1440,height:900}]){
    await page.setViewportSize(viewport);
    for(const id of [0,7,15,27,43,59]){await select(id);report.push(await geometry(`level ${id+1}`));}
    await page.screenshot({path:`test-results/screen-${viewport.width}x${viewport.height}.png`});
  }
  // Every campaign challenge is played through its normal touch controls.
  await page.setViewportSize({width:320,height:568});
  for(let id=0;id<60;id++){await select(id);await solve(id);await geometry(`win ${id+1}`);}
  await select(12);await shootAt(12,makeLevel(12).solution+.2);assert.equal(await page.locator('#result h3').innerText(),'Cible touchée.');assert.equal(await page.locator('#result .stars').getAttribute('aria-label'),'1 étoiles');await page.screenshot({path:'test-results/precision-edge.png'});
  await select(12);await shootAt(12,makeLevel(12).solution+.1);assert.equal(await page.locator('#result h3').innerText(),'Tir précis.');assert.equal(await page.locator('#result .stars').getAttribute('aria-label'),'2 étoiles');await page.screenshot({path:'test-results/precision-accurate.png'});
  // Retry invalidates pending shot callbacks and never awards the next level accidentally.
  await select(0);const b=await page.locator('#board').boundingBox(), p=projection(makeLevel(0),b.width,b.height);await page.touchscreen.tap(b.x+p.center.x,b.y+p.center.y);await page.locator('#retry').click();await page.waitForTimeout(750);assert.equal(await page.locator('#result').isHidden(),true);
  // The browser verifies the PWA manifest and icons, independently of our file tests.
  const cdp=await context.newCDPSession(page);const manifest=await cdp.send('Page.getAppManifest');assert.equal(manifest.errors.length,0);const install=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(install.installabilityErrors,[]);
  const cached=await page.evaluate(async()=>{const names=(await caches.keys()).filter(n=>n.startsWith('tangent-strike:'));const cache=await caches.open(names[0]);return (await cache.keys()).length;});assert.ok(cached>=14);
  await context.setOffline(true);await page.reload();await page.locator('#level-title').waitFor();await solve(0);await context.setOffline(false);
  assert.deepEqual(errors,[]);await writeFile('test-results/browser-report.json',JSON.stringify({layouts:report,played:60,offline:true,installabilityErrors:install.installabilityErrors,cached,errors},null,2));
  console.log(JSON.stringify({layouts:report.length,played:60,offline:true,cached,errors}));
}finally{await context.close();await rm(profile,{recursive:true,force:true});}
