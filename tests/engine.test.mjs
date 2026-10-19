import test from 'node:test';
import assert from 'node:assert/strict';
import {BOUNDS, derivative, fire, makeLevel, movingObstacle, movingTarget, projection, rayCircle, resistance, tangent, TOTAL_LEVELS, value} from '../.build/engine.js';
import {achievements, award, failAttempt, freshSave, levelUnlocked, loseLife, readSave, recordImpacts, recoverInterruptedAttempt, restartWorld, worldUnlocked} from '../.build/storage.js';
function apply(level, damage, result){for(const id of result.hits){const t=level.targets.find(t=>t.id===id);damage.set(id,Math.min(resistance(t),(damage.get(id)??0)+1));}}
function simulate(level, initialTime){
  const damage=new Map();let time=initialTime,used=0;
  for(const s of level.plan){
    if(s.targets.every(id=>(damage.get(id)??0)>=resistance(level.targets[id])))continue;
    if(s.stage!==undefined&&s.stage<(damage.get(s.targets[0])??0))continue;
    let result;
    for(let step=0;step<100;step++){
      const t=time+step*.12,r=fire(level,s.a,s.direction,t,damage);
      if(r.obstacleHits.length===0&&s.targets.some(id=>r.hits.includes(id))){result=r;time=t;break;}
    }
    assert.ok(result,`No safe window for level ${level.id}, a=${s.a}`);apply(level,damage,result);used++;
  }
  assert.ok(level.targets.every(t=>(damage.get(t.id)??0)>=resistance(t)),`Unsolved level ${level.id}`);
  assert.ok(used<=level.shots);return damage;
}
test('84 levels × 21 variants are solvable at seven starting times, with safe windows for moving obstacles',()=>{
  for(let v=0;v<=20;v++)for(let id=0;id<TOTAL_LEVELS;id++){
    const l=makeLevel(id,v);if(l.world===0)assert.ok(Math.abs(derivative(l.curve,l.solution))<1e-9);
    for(const time of [0,1,3,5,9,17,25])simulate(l,time);
  }
});
test('every target stage and moving obstacle stays inside mathematical bounds',()=>{
  for(let id=0;id<TOTAL_LEVELS;id++)for(let v=0;v<6;v++){
    const l=makeLevel(id,v);
    for(const time of [0,1.85,3.7,5.55,7.4]){
      const objects=l.targets.flatMap(t=>Array.from({length:resistance(t)},(_,d)=>({...movingTarget(l,t,time,d),radius:t.radius}))).concat(l.obstacles.map(o=>({...movingObstacle(o,time),radius:o.radius})));
      for(const p of objects)assert.ok(p.x-p.radius>=BOUNDS.left-.01&&p.x+p.radius<=BOUNDS.right+.01&&p.y-p.radius>=BOUNDS.bottom&&p.y+p.radius<=BOUNDS.top,`Out of bounds: ${id}/${v}`);
    }
  }
});
test('analytic derivatives agree with independent finite differences',()=>{
  for(let id=0;id<TOTAL_LEVELS;id++){const c=makeLevel(id).curve;for(const x of [-3,-1.2,0,.8,2.5]){const e=1e-5;assert.ok(Math.abs(derivative(c,x)-(value(c,x+e)-value(c,x-e))/(2*e))<1e-6);}}
});
test('all geometric solutions are accepted; direction rejects the opposite ray',()=>{
  const curve={kind:'polynomial',coefficients:[0,0,1],scale:1,h:0,k:0,label:'x²'};
  const l={...makeLevel(12),curve,targets:[{id:0,x:3,y:5,radius:.01,motion:0,phase:0}],obstacles:[]};
  assert.equal(tangent(curve,1,3),5);assert.equal(tangent(curve,5,3),5);
  assert.deepEqual(fire(l,1,'right',0).hits,[0]);assert.deepEqual(fire(l,5,'left',0).hits,[0]);
  assert.deepEqual(fire(l,1,'left',0).hits,[]);assert.deepEqual(fire(l,5,'right',0).hits,[]);
});
test('fixed split targets really require two or three tangent directions',()=>{
  for(const [id,maxPerShot] of [[48,1],[60,2],[61,1]]){
    const l=makeLevel(id);let max=0;
    for(let a=-5.25;a<=5.25;a+=.0125)max=Math.max(max,fire(l,a,'both',0).hits.length);
    assert.equal(max,maxPerShot,`Incorrect split for ${id}`);
  }
});
test('moving rendezvous can be completed in one timed shot or in two independent shots',()=>{
  const l=makeLevel(52),s=l.combination;
  assert.equal(fire(l,s.a,s.direction,0).hits.length,2);
  assert.ok(fire(l,s.a,s.direction,Math.PI/(2*.85)).hits.length<2);
  simulate(l,1.85);
});
test('armor takes one damage per trigger and bosses change their anchor after each hit',()=>{
  const armor=makeLevel(68);assert.equal(resistance(armor.targets[0]),2);
  const damage=new Map(),s=armor.plan[0];apply(armor,damage,fire(armor,s.a,s.direction,0,damage));assert.equal(damage.get(0),1);
  for(const id of [59,71,83]){
    const l=makeLevel(id),t=l.targets[0],before=movingTarget(l,t,0,0),after=movingTarget(l,t,0,1);
    assert.ok(t.boss&&resistance(t)>=3);assert.ok(Math.hypot(before.x-after.x,before.y-after.y)>1);simulate(l,0);
  }
});
test('obstacles block only their own branch and collision IDs are deduplicated',()=>{
  const curve={kind:'polynomial',coefficients:[0],scale:1,h:0,k:0,label:'0'};
  const l={...makeLevel(0),curve,targets:[{id:0,x:-3,y:0,radius:.1,motion:0,phase:0},{id:1,x:3,y:0,radius:.1,motion:0,phase:0}],obstacles:[{x:1,y:0,radius:.3}]};
  const r=fire(l,0,'both',0);assert.deepEqual(r.hits,[0]);assert.deepEqual(r.obstacleHits,[0]);assert.ok(Math.abs(r.beams[1].end.x-.7)<1e-8);
  assert.deepEqual(fire({...l,obstacles:[{x:0,y:0,radius:.3}]},0,'both',0).obstacleHits,[0]);
  const moving=makeLevel(73),a=moving.plan[0].a,dir=moving.plan[0].direction;
  assert.notEqual(fire(moving,a,dir,0).obstacleHits.length,fire(moving,a,dir,5.1).obstacleHits.length);
});
test('circle intersection handles backwards, inside and tangential contacts',()=>{
  assert.equal(rayCircle({x:0,y:0},{x:1,y:0},{x:-2,y:0},.2),null);
  assert.equal(rayCircle({x:0,y:0},{x:1,y:0},{x:0,y:0},1),0);
  assert.equal(rayCircle({x:0,y:0},{x:1,y:0},{x:2,y:1},1),2);
});
test('campaign requires all twelve levels in order and never advances from assisted wins',()=>{
  const s=freshSave();assert.equal(levelUnlocked(s,1),false);assert.equal(worldUnlocked(s,1),false);
  assert.equal(award(s,0,1,true,false),0);assert.equal(s.runs[0].next,0);assert.equal(s.stars[0],0);
  for(let id=0;id<8;id++)award(s,id,1,false,false);assert.equal(worldUnlocked(s,1),false);
  for(let id=8;id<12;id++)award(s,id,1,false,false);assert.equal(worldUnlocked(s,1),true);assert.equal(s.runs[0].cleared,true);
});
test('three lives reset the active world but preserve historical stars and completed access',()=>{
  const s=freshSave();for(let i=0;i<5;i++)award(s,i,1,false,false);
  const best=[...s.stars];loseLife(s,0);assert.equal(s.runs[0].next,5);loseLife(s,0);assert.equal(loseLife(s,0),true);
  assert.equal(s.runs[0].next,0);assert.equal(s.runs[0].lives,0);assert.deepEqual(s.stars,best);assert.equal(levelUnlocked(s,4),false);
  restartWorld(s,0);assert.equal(s.runs[0].lives,3);assert.equal(s.runs[0].seed,1);assert.deepEqual(s.stars,best);
});
test('a collision and final-shot failure charge one life; reload recovers an interrupted attempt once',()=>{
  const s=freshSave();s.activeAttempt=0;loseLife(s,0);failAttempt(s,0,true);assert.equal(s.runs[0].lives,2);
  s.activeAttempt=0;assert.equal(recoverInterruptedAttempt(s),true);assert.equal(s.runs[0].lives,1);assert.equal(recoverInterruptedAttempt(s),false);assert.equal(s.runs[0].lives,1);
});
test('old 60-level saves migrate without losing stars or previously open worlds',()=>{
  const old={version:1,stars:Array(60).fill(3),lastLevel:59,wins:60,sound:false};
  const s=readSave({getItem:()=>JSON.stringify(old)});assert.equal(s.version,2);assert.equal(s.stars.length,84);assert.deepEqual(s.stars.slice(0,60),old.stars);assert.equal(s.runs.slice(0,5).every(r=>r.cleared),true);assert.equal(worldUnlocked(s,5),true);assert.equal(worldUnlocked(s,6),false);assert.equal(s.sound,false);
  const partial=readSave({getItem:()=>JSON.stringify({...old,stars:Array(8).fill(2),lastLevel:12})});assert.equal(worldUnlocked(partial,1),true);assert.equal(partial.runs[0].next,8);
});
test('corrupt saves and disabled storage do not crash the game',()=>{
  assert.deepEqual(readSave({getItem:()=>'{'}),freshSave());assert.deepEqual(readSave({getItem:()=>{throw Error('disabled');}}),freshSave());
  const s=readSave({getItem:()=>JSON.stringify({version:2,stars:[9,-2,'3'],lastLevel:999,wins:-1,sound:false,runs:[{lives:99,next:-1,seed:'bad'}]})});assert.deepEqual(s.stars.slice(0,3),[3,0,0]);assert.equal(s.runs[0].lives,3);assert.equal(s.lastLevel,0);
});
test('precision and stars account for required impacts and collisions',()=>{
  const curve={kind:'polynomial',coefficients:[0],scale:1,h:0,k:0,label:'0'};
  for(const y of [0,.1,.3,.499]){const l={...makeLevel(12),curve,targets:[{id:0,x:2,y,radius:.5,motion:0,phase:0}],obstacles:[]};const r=fire(l,0,'right',0);assert.ok(Math.abs(r.impacts[0].precision-(1-y/.5))<1e-9);}
  const s=freshSave();assert.equal(award(s,0,1,false,false,.2),1);assert.equal(award(s,0,1,false,false,.6),2);assert.equal(award(s,0,3,false,false,.9,3),3);assert.equal(award(s,0,3,false,false,.9,3,1),2);assert.equal(s.stars[0],3);
});
test('adaptive camera contains all target stages and complete obstacle trajectories',()=>{
  for(let id=0;id<TOTAL_LEVELS;id++){
    const l=makeLevel(id);
    for(const [w,h] of [[294,150],[294,262],[462,135],[600,480]]){
      const p=projection(l,w,h);assert.ok(p.scale>0);
      for(const time of [0,1.85,5.55])for(const t of l.targets)for(let d=0;d<resistance(t);d++){
        const q=movingTarget(l,t,time,d),x=p.center.x+q.x*p.scale,y=p.center.y-q.y*p.scale,r=t.radius*p.scale;
        assert.ok(x-r>=0&&x+r<=w&&y-r>=p.top-.01&&y+r<=h-p.bottom+.01,`Invisible target ${id}`);
      }
    }
  }
});
test('fifty distinct achievements cover four categories; combat progress survives a save roundtrip',()=>{
  const s=freshSave(),all=achievements(s);assert.equal(all.length,50);assert.equal(new Set(all.map(a=>a.id)).size,50);assert.equal(new Set(all.map(a=>a.category)).size,4);assert.equal(all.some(a=>a.done),false);
  const l=makeLevel(70),r=fire(l,l.combination.a,'both',0);assert.equal(r.hits.length,3);recordImpacts(s,l,r,'both',[1,2]);assert.equal(s.stats.tripleShots,1);assert.equal(s.stats.hits,3);assert.equal(s.stats.moving,2);
  award(s,59,3,false,false,1,3);const again=readSave({getItem:()=>JSON.stringify(s)});assert.deepEqual(again.stats,s.stats);assert.equal(achievements(again).find(a=>a.id==='triple').done,true);assert.equal(achievements(again).find(a=>a.id==='boss-first').done,true);
  const prior=new Set(achievements(again).filter(a=>a.done).map(a=>a.id));restartWorld(again,4);for(const id of prior)assert.equal(achievements(again).find(a=>a.id===id).done,true);
});
