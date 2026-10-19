import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fire,makeLevel,projection,resistance,TOTAL_LEVELS,value} from '../.build/engine.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QA_URL||'http://127.0.0.1:5191/';
const profile=await mkdtemp(join(tmpdir(),'tangent-qa-'));
const context=await chromium.launchPersistentContext(profile,{headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),viewport:{width:320,height:568},hasTouch:true,deviceScaleFactor:2});
await context.addInitScript(()=>window.addEventListener('beforeinstallprompt',event=>{if(event.isTrusted)event.stopImmediatePropagation();},{capture:true}));
const errors=[],report=[];await mkdir('test-results',{recursive:true});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tangent-strike-v1')));
async function geometry(label){
 const r=await page.evaluate(()=>{
  const ss=['.topbar','.worlds','.level-heading','#health','#levels','.mission','#board','.control-bar','#feedback','#install','#hint','#retry','#direction-control','#timer','#result-next','#result-replay'];
  return{w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,boxes:ss.filter(s=>document.querySelector(s)&&document.querySelector(s).getBoundingClientRect().height>0).map(s=>{const r=document.querySelector(s).getBoundingClientRect();return{s,x:r.x,y:r.y,right:r.right,bottom:r.bottom,h:r.height,w:r.width};})};
 });
 assert.ok(r.sw<=r.w+1&&r.sh<=r.h+1,`${label}: overflow ${r.sw}×${r.sh}`);
 for(const b of r.boxes)assert.ok(b.x>=-.5&&b.y>=-.5&&b.right<=r.w+.5&&b.bottom<=r.h+.5,`${label}: clipped ${JSON.stringify(b)}`);
 const board=r.boxes.find(b=>b.s==='#board');assert.ok(board.h>=100,`${label}: plot too short`);
 return{label,viewport:`${r.w}×${r.h}`,board:`${Math.round(board.w)}×${Math.round(board.h)}`,fits:true};
}
async function seed(){
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('tangent-strike-v1'));s.version=2;s.stars=Array(84).fill(1);s.runs=Array.from({length:7},()=>({next:12,cleared:true,lives:3,seed:0}));s.unlockedWorld=6;s.activeAttempt=null;s.lastLevel=0;s.sound=false;s.reducedMotion=true;localStorage.setItem('tangent-strike-v1',JSON.stringify(s));});await page.reload();
}
async function select(id){
 await page.locator(`[data-world="${Math.floor(id/12)}"]`).click();
 if(await page.locator('#levels').isVisible())await page.locator(`button[data-level="${id}"]`).click();
 else{await page.locator('#help').click();await page.locator('#menu-levels').click();await page.locator(`[data-jump="${id}"]`).click();}
}
async function tapAt(l,a,dir){
 if(l.rule==='choose')await page.locator(`[data-direction="${dir}"]`).click();
 const r=await page.locator('#board').boundingBox(),p=projection(l,r.width,r.height);
 await page.touchscreen.tap(r.x+p.center.x+a*p.scale,r.y+p.center.y-value(l.curve,a)*p.scale);
}
async function solve(id){
 const l=makeLevel(id),damage=new Map();
 for(const s of l.plan){
  if(await page.locator('#result').isVisible())break;
  let result;
  for(let tries=0;tries<100;tries++){
   const time=Number(await page.locator('#board').getAttribute('data-time'));
   const r=fire(l,s.a,s.direction,time,damage),later=fire(l,s.a,s.direction,time+.25,damage);
   if(!r.obstacleHits.length&&!later.obstacleHits.length){result=r;break;}
   await page.waitForTimeout(100);
  }
  assert.ok(result,`No safe window in browser level ${id}`);
  await tapAt(l,s.a,s.direction);
  // The reduced-motion fixture shortens the animation, not the simulation or collision rules.
  await page.waitForTimeout(230);
  for(const hit of result.hits){const t=l.targets.find(t=>t.id===hit);damage.set(hit,Math.min(resistance(t),(damage.get(hit)??0)+1));}
 }
 await page.locator('#result:not([hidden])').waitFor({timeout:3000});
 assert.match(await page.locator('#result h3').innerText(),/Plein centre|Tir précis|Cibles? touchée|Objectif atteint|Dérivée suprême/);
 assert.equal((await read()).runs[l.world].lives,3,`Unexpected collision in level ${id}`);
}
try{
 await page.goto(base);await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();
 report.push(await geometry('new campaign'));
 assert.equal(await page.locator('button[data-level="1"]').isDisabled(),true);
 // The arrowhead is anchored to the mathematical point, including after a resize.
 for(const size of [{width:320,height:480},{width:390,height:844},{width:1440,height:900}]){
  await page.setViewportSize(size);await page.waitForTimeout(200);
  const l=makeLevel(0),r=await page.locator('#board').boundingBox(),p=projection(l,r.width,r.height),tip=await page.locator('#first-tip svg').boundingBox();
  assert.ok(Math.hypot(tip.x+tip.width*2/34-(r.x+p.center.x),tip.y+tip.height*2/34-(r.y+p.center.y))<4,`Arrow points away from curve: ${JSON.stringify({size,r,p,tip})}`);
 }
 await page.setViewportSize({width:320,height:568});await page.screenshot({path:'test-results/v2-tutorial.png'});
 await page.locator('#hint').click();assert.match(await page.locator('#modal-content').innerText(),/point.*exacts|points.*exacts/);assert.doesNotMatch(await page.locator('#modal-content').innerText(),/a =|f′\(a\) ≈/);await page.locator('#close-modal').click();
 // A started attempt cannot be reset or reloaded for unlimited free tries.
 await tapAt(makeLevel(0),1,'both');await page.locator('#retry').click();await page.waitForTimeout(750);assert.equal((await read()).runs[0].lives,2);assert.equal(await page.locator('#result').isHidden(),true);
 await tapAt(makeLevel(0),1,'both');await page.reload();assert.equal((await read()).runs[0].lives,1);
 await tapAt(makeLevel(0),1,'both');await page.locator('#retry').click();await page.locator('#result:not([hidden])').waitFor();assert.equal(await page.locator('#result h3').innerText(),'Bouclier épuisé.');assert.equal((await read()).runs[0].next,0);await page.screenshot({path:'test-results/v2-world-restart.png'});
 await page.locator('#result-next').click();assert.equal((await read()).runs[0].lives,3);assert.equal((await read()).runs[0].seed,1);
 // Fixtures open every campaign world for exhaustive physics/UI checks.
 await seed();
 for(const viewport of [{width:320,height:480},{width:320,height:568},{width:360,height:640},{width:375,height:667},{width:390,height:844},{width:430,height:932},{width:568,height:320},{width:844,height:390},{width:768,height:1024},{width:1024,height:768},{width:1440,height:900}]){
  await page.setViewportSize(viewport);
  for(const id of [0,7,27,43,52,59,68,71,83]){await select(id);report.push(await geometry(`level ${id+1}`));}
  await page.screenshot({path:`test-results/v2-${viewport.width}x${viewport.height}.png`});
 }
 await page.setViewportSize({width:320,height:568});
 for(let id=0;id<TOTAL_LEVELS;id++){await select(id);await solve(id);report.push(await geometry(`win ${id+1}`));}
 // Real obstacle penalty: one hit is one life, despite two beam branches.
 await select(43);const l=makeLevel(43);
 // The wrong direction on this level points directly into its rear obstacle.
 const shot=l.solution,shotDirection=l.solutionDirection==='left'?'right':'left';assert.ok(fire(l,shot,shotDirection,0).obstacleHits.length);await tapAt(l,shot,shotDirection);await page.waitForTimeout(250);assert.equal((await read()).runs[l.world].lives,2);
 // Laboratory solutions and armor do not mutate campaign stars, lives or frontier.
 const before=await read();await page.locator('#help').click();await page.locator('#menu-practice').click();await page.locator('[data-practice="6"]').click();await page.locator('button[data-level="83"]').click();await page.locator('#hint').click();assert.match(await page.locator('#feedback').innerText(),/a =/);const after=await read();assert.deepEqual(after.stars,before.stars);assert.deepEqual(after.runs.map(r=>r.next),before.runs.map(r=>r.next));
 await page.screenshot({path:'test-results/v2-boss-laboratory.png'});
 await page.locator('#help').click();await page.locator('#menu-achievements').click();assert.equal(await page.locator('[data-achievement]').count(),50);await page.locator('[data-category="Combats"]').click();assert.equal(await page.locator('[data-achievement]').count(),12);await page.screenshot({path:'test-results/v2-achievements.png'});await page.locator('#close-modal').click();
 const cdp=await context.newCDPSession(page);assert.equal((await cdp.send('Page.getAppManifest')).errors.length,0);const install=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(install.installabilityErrors,[]);
 await context.setOffline(true);await page.reload();await page.locator('#level-title').waitFor();assert.equal((await read()).version,2);const offlineLevel=makeLevel((await read()).lastLevel);await tapAt(offlineLevel,offlineLevel.solution,offlineLevel.solutionDirection);await page.locator('#result:not([hidden])').waitFor();assert.match(await page.locator('#result h3').innerText(),/Plein centre|Tir précis/);await context.setOffline(false);
 assert.deepEqual(errors,[]);const result={layouts:report,played:84,arrow:true,lives:true,armor:true,bosses:true,obstaclePenalty:true,offline:true,installabilityErrors:install.installabilityErrors,errors};await writeFile('test-results/browser-report-v2.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,layouts:report.length}));
}finally{await context.close();await rm(profile,{recursive:true,force:true});}
