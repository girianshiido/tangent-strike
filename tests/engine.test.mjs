import test from 'node:test';
import assert from 'node:assert/strict';
import {BOUNDS, derivative, fire, makeLevel, movingTarget, projection, rayCircle, tangent, TOTAL_LEVELS, value} from '../.build/engine.js';
import {award, freshSave, readSave, worldUnlocked} from '../.build/storage.js';
test('60 campaign levels and 1,200 variations remain solvable, including moving targets', () => {
  for (let variant=0;variant<=20;variant++) for(let id=0;id<TOTAL_LEVELS;id++) {
    const l=makeLevel(id,variant);
    if(l.world===0) assert.ok(Math.abs(derivative(l.curve,l.solution))<1e-9);
    if(l.rule!=='choose') assert.equal(l.rule,l.solutionDirection);
    for(const time of [0,1,3,5,9,17,25]) {
      const result=fire(l,l.solution,l.solutionDirection,time);
      assert.equal(result.hits.length,l.targets.length,`Unsolvable: ${id}, variant ${variant}, t=${time}`);
      for(const target of l.targets){const p=movingTarget(l,target,time);assert.ok(p.x-target.radius>=BOUNDS.left-.01&&p.x+target.radius<=BOUNDS.right+.01,`Target out of x bounds: ${id},${variant}`);assert.ok(p.y-target.radius>=BOUNDS.bottom&&p.y+target.radius<=BOUNDS.top,`Target out of y bounds: ${id},${variant}`);}
    }
  }
});
test('analytic derivatives agree with independent finite differences', () => {
  for(let id=0;id<TOTAL_LEVELS;id++){const c=makeLevel(id).curve;for(const x of [-3,-1.2,0,.8,2.5]){const e=1e-5;assert.ok(Math.abs(derivative(c,x)-(value(c,x+e)-value(c,x-e))/(2*e))<1e-6);}}
});
test('all geometric solutions are accepted; direction rejects the opposite ray', () => {
  const curve={kind:'polynomial',coefficients:[0,0,1],scale:1,h:0,k:0,label:'x²'};
  const l={...makeLevel(0),world:1,curve,targets:[{id:0,x:3,y:5,radius:.01,motion:0,phase:0}],obstacles:[]};
  assert.equal(tangent(curve,1,3),5);assert.equal(tangent(curve,5,3),5);
  assert.deepEqual(fire(l,1,'right',0).hits,[0]);assert.deepEqual(fire(l,5,'left',0).hits,[0]);
  assert.deepEqual(fire(l,1,'left',0).hits,[]);assert.deepEqual(fire(l,5,'right',0).hits,[]);
  assert.deepEqual(fire(l,5,'both',0).hits,[0]);
});
test('obstacles stop their branch at first contact, preserving the other branch', () => {
  const curve={kind:'polynomial',coefficients:[0],scale:1,h:0,k:0,label:'0'};
  const l={...makeLevel(0),curve,targets:[{id:0,x:-3,y:0,radius:.1,motion:0,phase:0},{id:1,x:3,y:0,radius:.1,motion:0,phase:0}],obstacles:[{x:1,y:0,radius:.3}]};
  const r=fire(l,0,'both',0);assert.deepEqual(r.hits,[0]);assert.equal(r.beams[1].blocked,true);assert.ok(Math.abs(r.beams[1].end.x-.7)<1e-8);
});
test('circle intersection handles origins inside, backwards and tangent contacts', () => {
  assert.equal(rayCircle({x:0,y:0},{x:1,y:0},{x:-2,y:0},.2),null);
  assert.equal(rayCircle({x:0,y:0},{x:1,y:0},{x:0,y:0},1),0);
  assert.equal(rayCircle({x:0,y:0},{x:1,y:0},{x:2,y:1},1),2);
});
test('campaign unlocks, hint stars and replay scores remain consistent', () => {
  const save=freshSave();assert.equal(worldUnlocked(save,1),false);
  for(let i=0;i<8;i++)award(save,i,1,false,false);
  assert.equal(worldUnlocked(save,1),true);assert.equal(worldUnlocked(save,2),false);
  assert.equal(award(save,8,1,true,false),1);assert.equal(award(save,8,2,false,false),2);assert.equal(award(save,8,1,false,true),3);award(save,8,3,true,false);assert.equal(save.stars[8],3);
});
test('invalid saves and unavailable storage do not crash the game', () => {
  assert.deepEqual(readSave({getItem:()=>'{'}),freshSave());
  assert.deepEqual(readSave({getItem:()=>{throw new Error('disabled');}}),freshSave());
  const s=readSave({getItem:()=>JSON.stringify({version:1,stars:[9,-2,'3'],lastLevel:999,wins:-1,sound:false})});
  assert.deepEqual(s.stars.slice(0,3),[3,0,0]);assert.equal(s.lastLevel,0);assert.equal(s.wins,0);assert.equal(s.sound,false);
});
test('precision distinguishes a central, accurate and grazing hit',()=>{
  const c={kind:'polynomial',coefficients:[0],scale:1,h:0,k:0,label:'0'};
  for(const y of [0,.1,.3,.499]){
    const l={...makeLevel(12),curve:c,targets:[{id:0,x:2,y,radius:.5,motion:0,phase:0}],obstacles:[]};
    const result=fire(l,0,'right',0);assert.deepEqual(result.hits,[0]);assert.ok(Math.abs(result.impacts[0].precision-(1-y/.5))<1e-9);
  }
  const save=freshSave();assert.equal(award(save,0,1,false,false,.2),1);assert.equal(award(save,0,1,false,false,.6),2);assert.equal(award(save,0,1,false,false,.9),3);assert.equal(award(save,0,2,false,false,1),2);assert.equal(award(save,0,1,true,false,1),1);
});
test('targets shrink smoothly and the adaptive plot keeps targets and obstacles visible',()=>{
  let radius=1;
  for(let id=0;id<60;id++){
    const l=makeLevel(id);assert.ok(l.targets[0].radius<radius);radius=l.targets[0].radius;
    for(const [w,h] of [[294,174],[294,262],[462,155],[600,480]]){
      const p=projection(l,w,h);assert.ok(p.scale>0);
      for(const t of [...l.targets,...l.obstacles]){
        const x=p.center.x+t.x*p.scale,y=p.center.y-t.y*p.scale,r=t.radius*p.scale;
        assert.ok(x-r>=0&&x+r<=w&&y-r>=p.top-.01&&y+r<=h-p.bottom+.01,`Invisible object: ${id},${w}×${h}`);
      }
    }
  }
});
